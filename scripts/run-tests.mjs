#!/usr/bin/env node
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_SUITES, OPT_IN_SUITES, SUITES, expandSuites } from './test-suites.mjs';
import { createGroupShutdown, trackChildExit } from './lib/process-group.mjs';
import {
  REPO_ENV,
  REPO_PATH_ENV,
  RUN_ID_ENV,
  alive,
  findLiveServers,
  killLiveServers,
  makeRunId,
  repoMarker,
} from './lib/live-server-processes.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const NODE_TEST_COMPAT_REGISTER = path.join(REPO_ROOT, 'tests', 'register-node-test-compat.mjs');
const NODE_TEST_COMPAT_IMPORT = pathToFileURL(NODE_TEST_COMPAT_REGISTER).href;

// Global wall-clock backstop for any one command. Even with per-test timeouts
// and client-side network deadlines in place, a wedged tool or an orphaned
// grandchild can keep a runner alive forever; this cap guarantees the sweep
// terminates. Per-suite `wallClockMs` overrides it; the env var overrides both.
const DEFAULT_WALL_CLOCK_MS = Number(process.env.IMPECCABLE_TEST_WALL_CLOCK_MS) || 1_200_000;

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (args.includes('--list')) {
  printSuites();
  process.exit(0);
}

if (args.includes('--cleanup')) {
  process.exit(cleanupRepoServers());
}

/**
 * Suite commands run in their own process group, which buys two things: the
 * wall-clock cap can SIGKILL a wedged tree whole (the runner, its per-file
 * `node --test` workers, and any grandchildren or browsers they left open),
 * and a Ctrl-C can end that same tree deterministically instead of orphaning
 * it. Nothing in this file may use spawnSync: a blocked event loop cannot run
 * the signal handlers that make either guarantee, and cannot reap the child it
 * is waiting on either.
 */
const shutdown = createGroupShutdown();

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { void shutdown.onSignal(exitCodeForSignal(sig)); });
}
// Nothing can be awaited here, so this is the one path that does not wait.
process.on('exit', () => shutdown.onExit());

/** The shell convention for "killed by signal N": 130 SIGINT, 143 SIGTERM, 129 SIGHUP. */
function exitCodeForSignal(sig) {
  return 128 + (os.constants.signals[sig] ?? 0);
}

const requestedSuites = args.filter((arg) => !arg.startsWith('-'));
let suites;
try {
  suites = expandSuites(requestedSuites);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

await main();

async function main() {
  for (const suiteName of suites) {
    const suite = SUITES[suiteName];
    console.log(`\n## test:${suiteName}`);
    console.log(suite.description);
    for (const command of suite.commands) {
      await runCommand(command, suiteName);
    }
  }
}

async function runCommand(command, suiteName) {
  const runId = makeRunId(REPO_ROOT);
  const inheritedNodeOptions = String(process.env.NODE_OPTIONS || '').trim();
  const compatNodeOption = `--import=${NODE_TEST_COMPAT_IMPORT}`;
  const env = {
    ...process.env,
    NODE_OPTIONS: [inheritedNodeOptions, compatNodeOption].filter(Boolean).join(' '),
    [RUN_ID_ENV]: runId,
    // The hash is what matching uses; the path rides along for a human reading
    // `ps -E` output and is never matched on.
    [REPO_ENV]: repoMarker(REPO_ROOT),
    [REPO_PATH_ENV]: REPO_ROOT,
    ...(command.env || {}),
  };
  const wallClockMs = command.wallClockMs ?? DEFAULT_WALL_CLOCK_MS;

  if (command.runner === 'bun' || command.runner === 'node-compat' || command.runner === 'node') {
    // `bun` remains accepted as a legacy catalog label while the metadata is
    // migrated, but every suite executes through node:test. The loader maps
    // remaining bun:test imports and legacy browser imports to repository-local
    // Node/puppeteer-core compatibility modules; no Bun or Playwright process is
    // started by this runner.
    await runNodeTests(command.files, command, { env, wallClockMs });
  } else {
    throw new Error(`Unsupported test runner "${command.runner}"`);
  }

  await assertNoLeakedServers(runId, suiteName);
}

async function runNodeTests(files, command, { env, wallClockMs }) {
  // One invocation for the whole file list: node --test runs each file in its
  // own child process regardless, so isolation is unchanged, but the
  // runner-per-file spawn overhead is gone and files execute concurrently.
  const nodeArgs = [
    `--import=${NODE_TEST_COMPAT_IMPORT}`,
    '--test',
    `--test-concurrency=${command.concurrency ?? 4}`,
  ];
  if (command.timeoutMs) nodeArgs.push(`--test-timeout=${command.timeoutMs}`);
  if (command.forceExit) nodeArgs.push('--test-force-exit');
  nodeArgs.push(...files);
  await runProcess(process.execPath, nodeArgs, { env, wallClockMs });
}

function runProcess(cmd, args, { env, wallClockMs }) {
  console.log(`$ ${formatCommand(cmd, args)}`);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      // Own process group: the wall-clock cap and the shutdown handler can
      // then take down the runner, every test file it forked, and anything
      // those forked, in one signal.
      detached: true,
      // stdin is deliberately not inherited. A detached child is a background
      // process group on the terminal, and a background read of the tty stops
      // the process with SIGTTIN. No suite reads the runner's stdin.
      stdio: ['ignore', 'inherit', 'inherit'],
      env,
    });
    // Registered before the handlers below, so `hasExited` is already set by
    // the time they run and a shutdown mid-exit does not signal a dead pid.
    const running = shutdown.track(trackChildExit(child));

    let timedOut = false;
    const timer = wallClockMs
      ? setTimeout(() => {
          timedOut = true;
          console.error(
            `\n[run-tests] wall-clock cap of ${wallClockMs}ms exceeded for "${formatCommand(cmd, args)}"; ` +
            'killing the process group (SIGKILL).',
          );
          try { process.kill(-running.child.pid, 'SIGKILL'); }
          catch { try { running.child.kill('SIGKILL'); } catch { /* already gone */ } }
        }, wallClockMs)
      : null;

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      shutdown.release();
      console.error(err.message);
      process.exit(1);
    });
    child.on('exit', (code, signal) => {
      if (timer) clearTimeout(timer);
      shutdown.release();
      if (shutdown.shuttingDown) return;
      if (timedOut) {
        assertNoLeakedServers(env[RUN_ID_ENV], null).finally(() => process.exit(1));
        return;
      }
      if (signal) {
        console.error(`[run-tests] "${formatCommand(cmd, args)}" killed by signal ${signal}`);
        assertNoLeakedServers(env[RUN_ID_ENV], null).finally(() => process.exit(1));
        return;
      }
      if (code !== 0) {
        assertNoLeakedServers(env[RUN_ID_ENV], null).finally(() => process.exit(code || 1));
        return;
      }
      resolve();
    });
  });
}

async function assertNoLeakedServers(runId, suiteName) {
  if (!runId || process.env.IMPECCABLE_SKIP_LEAK_CHECK === '1') return;
  let leaked = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    leaked = findLiveServers({ runId });
    if (!leaked.length) return;
    await new Promise((r) => setTimeout(r, 200));
  }

  killLiveServers(leaked);
  const label = suiteName ? `test:${suiteName}` : 'the suite';
  console.error(`\nLeaked live servers: ${label} left ${leaked.length} live server process(es) running.`);
  for (const { pid, command } of leaked) console.error(`  pid ${pid}  ${command}`);
  console.error('They have been killed. A live server outliving its suite means a teardown path');
  console.error('was skipped; see tests/lib/live-servers.mjs for how servers are meant to be tracked.');
  console.error('Set IMPECCABLE_SKIP_LEAK_CHECK=1 to bypass this check.');
  process.exit(1);
}

function cleanupRepoServers() {
  const leaked = findLiveServers({ repo: REPO_ROOT });
  if (!leaked.length) {
    console.log('No leftover live servers from this repo\'s test runs.');
    return 0;
  }
  for (const { pid, command } of leaked) console.log(`killing pid ${pid}  ${command}`);
  killLiveServers(leaked);
  const survivors = leaked.filter(({ pid }) => alive(pid));
  if (survivors.length) {
    console.error(`Could not kill ${survivors.length} process(es): ${survivors.map((p) => p.pid).join(', ')}`);
    return 1;
  }
  console.log(`Killed ${leaked.length} leftover live server process(es).`);
  return 0;
}

function formatCommand(cmd, args) {
  const bin = cmd === process.execPath ? 'node' : cmd;
  return [bin, ...args].join(' ');
}

function printHelp() {
  console.log(`Usage: node scripts/run-tests.mjs [suite...]

Aliases:
  default     ${DEFAULT_SUITES.join(', ')}
  all-local   ${DEFAULT_SUITES.join(', ')}
  all         ${[...DEFAULT_SUITES, ...OPT_IN_SUITES].join(', ')}

Run with --list to see suite contents.
Run with --cleanup to kill live servers a previous run left behind.`);
}

function printSuites() {
  for (const [name, suite] of Object.entries(SUITES)) {
    const marker = suite.optIn ? ' (opt-in)' : '';
    console.log(`\n${name}${marker}`);
    console.log(`  ${suite.description}`);
    for (const command of suite.commands) {
      const effectiveRunner = command.runner === 'bun' ? 'node-compat' : command.runner;
      console.log(`  ${effectiveRunner}:`);
      for (const file of command.files) console.log(`    ${file}`);
    }
  }
}

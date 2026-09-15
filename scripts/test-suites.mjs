import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SUITES = ['core', 'oracle', 'detector', 'live', 'framework', 'plugin-e2e'];
export const OPT_IN_SUITES = [
  'cli-remote-e2e',
  'live-e2e',
  'live-e2e-accept-cleanup',
  'new-work-e2e',
  'skill-behavior',
  'skill-workflow',
  'live-svelte-adapter-deepseek',
];

const COMMON_INFRA_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^scripts\/run-tests\.mjs$/,
  /^scripts\/test-suites\.mjs$/,
  /^scripts\/ci-test-plan\.mjs$/,
  /^scripts\/lib\/(live-server-processes|process-group|test-orphan-reaper)\.mjs$/,
  /^tests\/lib\/live-servers\.mjs$/,
  /^\.github\/workflows\/ci\.yml$/,
];

export const SUITES = {
  core: {
    description: 'Build, provider transforms, hook manifests, plugin validators, and prose gates.',
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^scripts\/(?!build-extension)/,
      /^skill\/(SKILL\.src\.md|agents\/|reference\/|scripts\/)/,
      /^ENGINE_VERSION$/,
      /^README(\.npm)?\.md$/,
      /^vscode\//,
      /^\.github\/workflows\/release-engine\.yml$/,
      /^cli\/bin\//,
    ],
    commands: [
      {
        runner: 'node-compat',
        files: [
          'tests/build.test.js',
          'tests/lib/provider-blocks.test.js',
          'tests/lib/transformers/provider-blocks.test.js',
          'tests/lib/utils.test.js',
          'tests/lib/transformers/factory.test.js',
          'tests/lib/transformers/opencode-commands.test.js',
          'tests/lib/transformers/providers.test.js',
          'tests/root-commands-sync.test.js',
          'tests/validate-plugin-versions.test.js',
          'tests/validate-plugin-manifest.test.js',
          'tests/plugin-paths.test.js',
          'tests/release-engine-workflow.test.js',
          'tests/workflow-security.test.js',
        ],
      },
      {
        runner: 'node',
        timeoutMs: 180000,
        files: [
          'tests/ci-test-plan.test.mjs',
          'tests/cli-shim.test.mjs',
          'tests/launcher-download.test.mjs',
          'tests/publish-platform-packages.test.mjs',
          'tests/github-sheriff.test.mjs',
          'tests/hook-build.test.mjs',
          'tests/openai-plugin.test.mjs',
          'tests/cursor-plugin.test.mjs',
          'tests/vscode-extension.test.mjs',
          'tests/process-group.test.mjs',
          'tests/release.test.mjs',
          'tests/bundle-signing.test.mjs',
          'tests/skill-reference.test.mjs',
          'tests/skill-behavior-harness.test.mjs',
          'tests/readme-gitignore.test.mjs',
          'tests/test-suites.test.mjs',
        ],
      },
    ],
  },
  // The verbs live in the engine binary; this repo pins its behavior with the
  // oracle goldens and drives live-mode verbs over framework fixtures. Both
  // skip when no binary is present (npm run fetch:engine, or IMPECCABLE_BIN).
  oracle: {
    description: 'Oracle corpus replay against the engine binary; skips without a binary.',
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^ENGINE_VERSION$/,
      /^tests\/oracle\//,
      /^tests\/fixtures\//,
      /^tests\/lib\/engine-bin\.mjs$/,
      /^skill\/(reference\/|scripts\/)/,
    ],
    commands: [{ runner: 'node', timeoutMs: 900000, files: ['tests/oracle.test.mjs'] }],
  },
  detector: {
    description: 'Extension packaging checks (the rule logic itself is covered by the crate tests and the oracle).',
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^extension\/(background|content|detector|devtools|offscreen|popup|shared|manifest\.json)/,
      /^scripts\/build-extension\.js$/,
      /^browser-bundle\//,
      /^crates\/(bundle|core|foundation|wasm|xtask)\//,
      /^crates\/live\/assets\//,
    ],
    commands: [{ runner: 'node', files: ['tests/extension-build.test.mjs'] }],
  },
  live: {
    description: 'Live-mode reference contract checks plus live E2E helper units; live verbs are covered by oracle and framework suites.',
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^skill\/(reference\/live\.md|scripts\/live-browser)/,
      /^tests\/live-e2e\//,
      /^tests\/lib\/engine-bin\.mjs$/,
      /^tests\/live-agent-target\.test\.mjs$/,
      /^tests\/live-boot-fastpath\.test\.mjs$/,
    ],
    commands: [{
      runner: 'node',
      files: [
        'tests/live-reference.test.mjs',
        'tests/live-agent-target.test.mjs',
        'tests/live-boot-fastpath.test.mjs',
        'tests/live-browser-ignores.test.mjs',
        'tests/live-browser-source.test.mjs',
        'tests/live-e2e-agent-output.test.mjs',
        'tests/live-e2e-cli-options.test.mjs',
        'tests/live-e2e-llm-agent.test.mjs',
        'tests/live-e2e-steer-agent.test.mjs',
        'tests/live-e2e/agent-insert.test.mjs',
        'tests/live-server-leak.test.mjs',
      ],
    }],
  },
  framework: {
    description: 'Framework fixture coverage for live injection, CSP detection, and wrapping through the engine binary; skips without a binary.',
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^ENGINE_VERSION$/,
      /^tests\/framework-fixtures/,
      /^tests\/framework-fixtures\.test\.mjs$/,
      /^tests\/lib\/engine-bin\.mjs$/,
    ],
    commands: [{ runner: 'node', files: ['tests/framework-fixtures.test.mjs'] }],
  },
  'cli-remote-e2e': {
    description: 'Remote CLI install/update smoke (moved to the engine repo; no tests here).',
    optIn: true,
    triggers: [...COMMON_INFRA_PATTERNS],
    commands: [],
  },
  'plugin-e2e': {
    description: 'Install the committed ./plugin subtree into a real sandboxed Claude Code and assert skills, agents, and hooks load.',
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^plugin\//,
      /^skill\/agents\//,
      /^scripts\/build\.js$/,
      /^scripts\/lib\/validate-plugin-manifest\.js$/,
      /^tests\/plugin-e2e\.test\.mjs$/,
    ],
    commands: [{ runner: 'node', timeoutMs: 300000, forceExit: true, files: ['tests/plugin-e2e.test.mjs'] }],
  },
  'live-e2e': {
    description: 'Full puppeteer-core live-mode click-to-accept sweep across runtime framework fixtures.',
    optIn: true,
    needsBrowser: true,
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^skill\/scripts\/live-browser/,
      /^ENGINE_VERSION$/,
      /^tests\/framework-fixtures/,
      /^tests\/live-e2e(\.test\.mjs|\/)/,
    ],
    commands: [{ runner: 'node', timeoutMs: 600000, forceExit: true, files: ['tests/live-e2e.test.mjs'] }],
  },
  'new-work-e2e': {
    description: 'puppeteer-core smoke sweep of the new-work decision page plus the offline fake image generator.',
    optIn: true,
    needsBrowser: true,
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^ENGINE_VERSION$/,
      /^tests\/new-work-e2e(\.test\.mjs|\/)/,
    ],
    commands: [{ runner: 'node', timeoutMs: 600000, forceExit: true, files: ['tests/new-work-e2e.test.mjs'] }],
  },
  'live-e2e-accept-cleanup': {
    description: 'Provider-backed post-accept cleanup regression.',
    optIn: true,
    needsBrowser: true,
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^ENGINE_VERSION$/,
      /^tests\/live-e2e-accept-cleanup-regression\.test\.mjs$/,
      /^tests\/live-e2e\//,
    ],
    commands: [{ runner: 'node', timeoutMs: 600000, files: ['tests/live-e2e-accept-cleanup-regression.test.mjs'] }],
  },
  'live-e2e-agent': {
    description: 'Focused insert-mode fake-agent helper tests.',
    commands: [{ runner: 'node', files: ['tests/live-e2e/agent-insert.test.mjs'] }],
  },
  'skill-behavior': {
    description: 'LLM-backed protocol checkpoints, not full builds.',
    optIn: true,
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^skill\/SKILL\.src\.md$/,
      /^skill\/reference\//,
      /^ENGINE_VERSION$/,
      /^tests\/skill-behavior\//,
    ],
    commands: [{ runner: 'node', timeoutMs: 240000, wallClockMs: 1_800_000, files: ['tests/skill-behavior/scenarios.test.mjs'] }],
  },
  'skill-workflow': {
    description: 'Explicitly opt-in completed workflows with a preflighted host browser.',
    optIn: true,
    needsBrowser: true,
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^skill\//,
      /^ENGINE_VERSION$/,
      /^tests\/skill-workflow\//,
      /^tests\/skill-behavior\//,
    ],
    commands: [
      { runner: 'node', files: ['tests/skill-workflow-browser.test.mjs'] },
      { runner: 'node', timeoutMs: 240000, wallClockMs: 600000, files: ['tests/skill-workflow/finish-handoff.test.mjs'] },
      { runner: 'node', timeoutMs: 900000, wallClockMs: 3_600_000, files: ['tests/skill-workflow/full-build.test.mjs'] },
    ],
  },
  'live-svelte-adapter-deepseek': {
    description: 'DeepSeek-backed Svelte adapter browser sweep.',
    optIn: true,
    needsBrowser: true,
    triggers: [
      ...COMMON_INFRA_PATTERNS,
      /^ENGINE_VERSION$/,
      /^tests\/framework-fixtures\/vite8-sveltekit-stateful\//,
      /^tests\/live-svelte-adapter-deepseek\.test\.mjs$/,
    ],
    commands: [{ runner: 'node', timeoutMs: 1200000, files: ['tests/live-svelte-adapter-deepseek.test.mjs'] }],
  },
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const suite of Object.values(SUITES)) {
  const ownFiles = suite.commands.flatMap((command) => command.files);
  suite.triggers = [
    ...(suite.triggers ?? []),
    ...ownFiles.map((file) => new RegExp(`^${escapeRegExp(file)}$`)),
  ];
}

export function expandSuites(requested) {
  const names = requested.length === 0 ? ['default'] : requested;
  const expanded = [];
  for (const name of names) {
    if (name === 'default' || name === 'all-local') {
      expanded.push(...DEFAULT_SUITES);
    } else if (name === 'all') {
      expanded.push(...DEFAULT_SUITES, ...OPT_IN_SUITES);
    } else if (SUITES[name]) {
      expanded.push(name);
    } else {
      throw new Error(`Unknown test suite "${name}". Run: node scripts/run-tests.mjs --list`);
    }
  }
  return [...new Set(expanded)];
}

export function suiteFiles(suiteNames) {
  const files = [];
  for (const name of suiteNames) {
    const suite = SUITES[name];
    if (!suite) throw new Error(`Unknown test suite "${name}"`);
    for (const command of suite.commands) files.push(...command.files);
  }
  return files;
}

export function findTestFiles(root = process.cwd()) {
  const out = [];
  const stack = [path.join(root, 'tests')];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (/\.test\.(js|mjs)$/.test(entry.name)) {
        out.push(path.relative(root, abs).split(path.sep).join('/'));
      }
    }
  }
  return out.sort();
}

export function matchesSuiteTriggers(suiteName, changedFiles) {
  const suite = SUITES[suiteName];
  if (!suite) throw new Error(`Unknown test suite "${suiteName}"`);
  return changedFiles.some((file) => suite.triggers?.some((pattern) => pattern.test(file)));
}

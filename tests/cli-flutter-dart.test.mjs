import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'cli', 'bin', 'cli.js');
const BAD_DART = path.join(ROOT, 'tests', 'fixtures', 'flutter', 'bad.dart');
const GOOD_DART = path.join(ROOT, 'tests', 'fixtures', 'flutter', 'good.dart');
const BAD_PROJECT = path.join(ROOT, 'tests', 'fixtures', 'flutter', 'project-bad');

function run(args) {
  const result = spawnSync('node', [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 15000,
  });
  return {
    code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

describe('CLI Flutter/Dart detection', () => {
  it('returns JSON findings and exit code 2 for a bad Dart file', () => {
    const result = run(['detect', '--json', '--no-config', BAD_DART]);
    assert.equal(result.code, 2, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.some((finding) => finding.antipattern === 'flutter-over-rounded-card'));
    assert.ok(parsed.some((finding) => finding.antipattern === 'flutter-missing-semantics-action'));
  });

  it('returns JSON [] and exit code 0 for a good Dart file', () => {
    const result = run(['detect', '--json', '--no-config', GOOD_DART]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), []);
  });

  it('supports the shorthand target form for Dart files', () => {
    const result = run(['--json', '--no-config', BAD_DART]);
    assert.equal(result.code, 2, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.length > 0);
  });

  it('scans a Flutter project directory containing Dart source', () => {
    const result = run(['detect', '--json', '--no-config', BAD_PROJECT]);
    assert.equal(result.code, 2, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.some((finding) => finding.file.endsWith(path.join('lib', 'main.dart'))));
    assert.ok(parsed.some((finding) => finding.antipattern === 'flutter-over-rounded-card'));
  });

  it('preserves detect --help', () => {
    const result = run(['detect', '--help']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Usage: impeccable detect/);
  });
});

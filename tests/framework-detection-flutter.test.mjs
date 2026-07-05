import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  detectFlutterProject,
  detectFrameworkConfig,
} from '../cli/engine/node/file-system.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FLUTTER_FIXTURE = path.join(ROOT, 'tests', 'framework-fixtures', 'flutter-basic', 'files');
const VITE_FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'antipatterns', 'framework-vite');
const CLI = path.join(ROOT, 'cli', 'bin', 'cli.js');

function withProject(files, callback) {
  const root = mkdtempSync(path.join(tmpdir(), 'impeccable-flutter-fw-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(root, rel);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('Flutter framework detection', () => {
  it('detects a source-only Flutter project from pubspec.yaml and lib/main.dart', () => {
    withProject({
      'pubspec.yaml': 'name: source_only\ndependencies:\n  flutter:\n    sdk: flutter\n',
      'lib/main.dart': 'void main() {}',
    }, (root) => {
      const result = detectFlutterProject(root);
      assert.equal(result.name, 'Flutter');
      assert.equal(result.port, null);
      assert.equal(result.optionalServer, true);
      assert.equal(result.sourceOnly, true);
      assert.equal(result.flutter.hasPubspec, true);
      assert.equal(result.flutter.hasMainDart, true);
      assert.equal(result.flutter.projectType, 'flutter-source');
    });
  });

  it('detects Flutter Web signals without requiring a running server', () => {
    const result = detectFrameworkConfig(FLUTTER_FIXTURE);
    assert.equal(result.name, 'Flutter');
    assert.equal(result.port, null);
    assert.equal(result.optionalServer, true);
    assert.equal(result.sourceOnly, false);
    assert.equal(result.flutter.hasPubspec, true);
    assert.equal(result.flutter.hasMainDart, true);
    assert.equal(result.flutter.hasWebIndex, true);
    assert.deepEqual(result.flutter.webSignals, ['web/index.html']);
    assert.equal(result.flutter.projectType, 'flutter-web');
  });

  it('preserves existing Vite framework detection', () => {
    const result = detectFrameworkConfig(VITE_FIXTURE);
    assert.equal(result.name, 'Vite');
    assert.equal(result.port, 8080);
  });

  it('CLI reports Flutter without inventing a localhost port', () => {
    const result = spawnSync('node', [CLI, 'detect', '--no-config', FLUTTER_FIXTURE], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Flutter project detected/);
    assert.match(result.stderr, /Dart source code/);
    assert.doesNotMatch(result.stderr, /localhost:null/);
  });
});

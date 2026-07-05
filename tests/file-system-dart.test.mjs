import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  SCANNABLE_EXTENSIONS,
  SKIP_DIRS,
  walkDir,
} from '../cli/engine/node/file-system.mjs';

function withFixture(files, callback) {
  const root = mkdtempSync(path.join(tmpdir(), 'impeccable-files-'));
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

function relativeResults(root) {
  return walkDir(root)
    .map((file) => path.relative(root, file).split(path.sep).join('/'))
    .sort();
}

describe('file-system walker Flutter/Dart support', () => {
  it('includes .dart as a scannable source extension', () => {
    assert.equal(SCANNABLE_EXTENSIONS.has('.dart'), true);
  });

  it('discovers Dart files while preserving existing web source extensions', () => {
    withFixture({
      'lib/main.dart': 'void main() {}',
      'src/App.jsx': 'export function App() { return <main />; }',
      'src/App.tsx': 'export function App() { return <main />; }',
      'src/styles.css': '.app { color: black; }',
      'src/component.vue': '<template><main /></template>',
      'src/component.svelte': '<main />',
      'src/page.astro': '<main />',
      'index.html': '<!doctype html><html></html>',
      'pubspec.yaml': 'name: fixture',
    }, (root) => {
      assert.deepEqual(relativeResults(root), [
        'index.html',
        'lib/main.dart',
        'src/App.jsx',
        'src/App.tsx',
        'src/component.svelte',
        'src/component.vue',
        'src/page.astro',
        'src/styles.css',
      ]);
    });
  });

  it('keeps generated and dependency directories ignored for Dart files', () => {
    withFixture({
      'lib/main.dart': 'void main() {}',
      'node_modules/package/bad.dart': 'void ignored() {}',
      '.git/hooks/bad.dart': 'void ignored() {}',
      'dist/bad.dart': 'void ignored() {}',
      'build/bad.dart': 'void ignored() {}',
    }, (root) => {
      assert.deepEqual(relativeResults(root), ['lib/main.dart']);
      for (const dir of ['node_modules', '.git', 'dist', 'build']) {
        assert.equal(SKIP_DIRS.has(dir), true);
      }
    });
  });
});

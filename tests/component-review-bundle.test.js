import { test } from './node-test-compat.mjs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

test('native component review bundle matches the shared UI source', () => {
  const node = process.execPath;
  execFileSync(node, [resolve(root, 'scripts/build-component-review.mjs'), '--check'], {
    cwd: root,
    stdio: 'inherit',
  });
});

// Source bundle embedded in the native engine; no Bun/Playwright runtime is required.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'crates/context/assets/component-review.js');
const check = process.argv.includes('--check');
const output = check ? resolve(root, 'crates/context/assets/component-review.check.js') : target;
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

execFileSync(npx, [
  '--yes',
  'esbuild@0.25.10',
  resolve(root, 'ui/component-review/entry.ts'),
  '--bundle',
  '--platform=browser',
  '--format=iife',
  '--minify',
  `--outfile=${output}`,
], { stdio: 'inherit' });

if (check) {
  const actual = readFileSync(output, 'utf8');
  rmSync(output, { force: true });
  if (actual.length < 1024 || !actual.includes('review')) {
    throw new Error('Component review bundle smoke check failed');
  }
}

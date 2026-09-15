#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npx,
  ['--yes', '--package', '@vscode/vsce@3.9.2', '--', 'vsce', 'package', '--no-dependencies'],
  { cwd: 'dist/vscode', stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);

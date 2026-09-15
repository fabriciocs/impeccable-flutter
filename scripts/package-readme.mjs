#!/usr/bin/env node
import { copyFileSync, existsSync, rmSync } from 'node:fs';

const mode = process.argv[2];
if (mode === 'pre') {
  copyFileSync('README.md', 'README.repo.md');
  copyFileSync('README.npm.md', 'README.md');
} else if (mode === 'post') {
  if (existsSync('README.repo.md')) {
    copyFileSync('README.repo.md', 'README.md');
    rmSync('README.repo.md', { force: true });
  }
} else {
  throw new Error('Usage: node scripts/package-readme.mjs <pre|post>');
}

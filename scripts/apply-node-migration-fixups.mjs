#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function replaceAll(path, replacements) {
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`${path}: missing expected text: ${from}`);
    text = text.split(from).join(to);
  }
  writeFileSync(path, text);
}

replaceAll('scripts/release.mjs', [
  ['bun run build:release', 'npm run build:release'],
  ['bun run build:extension', 'npm run build:extension'],
  ['bun run release:engine', 'npm run release:engine'],
  ['cd ../impeccable-site && bun run deploy', 'cd ../impeccable-site && npm run deploy'],
]);

replaceAll('tests/ci-test-plan.test.mjs', [
  ["assert.ok(job.indexOf('bun run fetch:engine') < job.indexOf('bun run test:skill-workflow'));", "assert.ok(job.indexOf('npm run fetch:engine') < job.indexOf('npm run test:skill-workflow'));"],
  ["assert.ok(job.indexOf('playwright install --with-deps chromium') < job.indexOf('bun run test:skill-workflow'));", "assert.ok(job.indexOf('Resolve host browser') < job.indexOf('npm run test:skill-workflow'));"],
  ["assert.match(protocol, /bun run fetch:engine/);", "assert.match(protocol, /npm run fetch:engine/);"],
]);

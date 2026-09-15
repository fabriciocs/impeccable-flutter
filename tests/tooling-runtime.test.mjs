import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIRECT_FILES = [
  'package.json',
  '.gitignore',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/DEVELOP.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
];
const DIRECTORIES = ['.github/workflows', 'scripts', 'tests'];
const SELF = 'tests/tooling-runtime.test.mjs';

const FORBIDDEN = [
  ['setup-bun action', /oven-sh\/setup-bun/i],
  ['Bun install', /\bbun\s+install\b/i],
  ['Bun script invocation', /\bbun\s+run\b/i],
  ['bunx invocation', /\bbunx\b/i],
  ['Bun lockfile reference', /\bbun\.lock\b/i],
  ['Playwright browser install', /(?:npx\s+)?playwright\s+install/i],
  ['Playwright cache', /ms-playwright/i],
  ['Playwright package import', /(?:from\s+|import\(\s*|require\(\s*)['"](?:@playwright\/test|playwright-core|playwright)['"]/i],
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.(?:js|mjs|cjs|json|ya?ml|md)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

function activeFiles() {
  return [...DIRECT_FILES, ...DIRECTORIES.flatMap(walk)]
    .filter((file) => file !== SELF)
    .filter((file) => file !== 'docs/NODE-NPM-PUPPETEER-MIGRATION.md');
}

describe('tooling runtime migration', () => {
  it('keeps active tooling on Node/npm + puppeteer-core', () => {
    const findings = [];
    for (const file of activeFiles()) {
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      for (const [label, pattern] of FORBIDDEN) {
        if (pattern.test(text)) findings.push(`${file}: ${label}`);
      }
    }
    assert.deepEqual(findings, [], findings.join('\n'));
  });
});

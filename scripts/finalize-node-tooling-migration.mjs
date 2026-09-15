#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function update(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) console.log(`${path}: no changes`);
  else {
    writeFileSync(path, after);
    console.log(`${path}: updated`);
  }
}

function activeDocs(text) {
  return text
    .replaceAll('bun run ', 'npm run ')
    .replaceAll('bun test tests/build.test.js', 'node --test tests/build.test.js')
    .replaceAll('bun test', 'node --test')
    .replaceAll('npx playwright install --with-deps chromium', 'set PUPPETEER_EXECUTABLE_PATH to an installed Chrome/Chromium/Edge binary when auto-discovery is unavailable')
    .replaceAll('npx playwright install chromium', 'set `PUPPETEER_EXECUTABLE_PATH` to an installed Chrome/Chromium/Edge binary if auto-discovery is unavailable')
    .replaceAll('Playwright Chromium', 'puppeteer-core with host Chrome/Chromium/Edge')
    .replaceAll("Playwright's browser cache", 'an installed Chrome/Chromium/Edge browser')
    .replaceAll('Playwright browser install', 'host browser resolution')
    .replaceAll('Playwright, offline', 'puppeteer-core, offline')
    .replaceAll('Playwright', 'puppeteer-core')
    .replaceAll('playwright', 'puppeteer-core')
    .replaceAll('Bun (fast JavaScript runtime and package manager)', 'Node.js 22.18+ and npm')
    .replaceAll("Bun's test runner plus Node's built-in `--test`", "Node's built-in `node:test` runner")
    .replaceAll('full Bun + Node test suite', 'full Node test suite')
    .replaceAll('Bun test suite', 'Node test suite')
    .replaceAll('Rust and Bun/Node checks', 'Rust and Node checks');
}

for (const path of ['CLAUDE.md', 'AGENTS.md', 'docs/DEVELOP.md', '.github/PULL_REQUEST_TEMPLATE.md']) {
  update(path, activeDocs);
}

const rootBrowserTests = [
  'tests/live-e2e.test.mjs',
  'tests/new-work-e2e.test.mjs',
  'tests/live-e2e-accept-cleanup-regression.test.mjs',
  'tests/live-svelte-adapter-deepseek.test.mjs',
  'tests/skill-workflow-browser.test.mjs',
];
for (const path of rootBrowserTests) {
  update(path, (text) => text
    .replaceAll("'playwright'", "'./lib/browser-driver.mjs'")
    .replaceAll('"playwright"', '"./lib/browser-driver.mjs"')
    .replaceAll('Playwright', 'puppeteer-core'));
}

for (const path of ['tests/new-work-e2e/user-bot.mjs', 'tests/skill-workflow/browser.mjs', 'tests/live-e2e/session.mjs']) {
  update(path, (text) => text
    .replaceAll("'playwright'", "'../lib/browser-driver.mjs'")
    .replaceAll('"playwright"', '"../lib/browser-driver.mjs"')
    .replaceAll('Playwright', 'puppeteer-core'));
}

update('tests/live-e2e/ui.mjs', (text) => text.replaceAll('Playwright', 'puppeteer-core'));

update('tests/node-test-loader.mjs', (text) => {
  let next = text.replace("const BROWSER_DRIVER_URL = new URL('./lib/browser-driver.mjs', import.meta.url).href;\n", '');
  next = next.replace(/\n  if \(specifier === 'playwright'\) \{\n    return \{ url: BROWSER_DRIVER_URL, shortCircuit: true \};\n  \}/, '');
  return next;
});

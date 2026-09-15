#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const genericFiles = [
  '.github/workflows/release-engine.yml',
  'scripts/build.js',
  'scripts/check-engine-release.mjs',
  'scripts/lib/validate-plugin-manifest.js',
  'scripts/publish-platform-packages.mjs',
  'scripts/release.mjs',
  'scripts/smoke-provider-hooks.mjs',
  'tests/framework-fixtures/README.md',
  'tests/hook-build.test.mjs',
  'tests/lib/engine-bin.mjs',
  'tests/live-e2e/preactions.mjs',
  'tests/live-e2e/steer.mjs',
  'tests/live-e2e/ui.mjs',
  'tests/live-e2e.test.mjs',
  'tests/new-work-e2e/README.md',
  'tests/new-work-e2e.test.mjs',
  'tests/oracle/README.md',
  'tests/oracle.test.mjs',
  'tests/plugin-e2e.test.mjs',
  'tests/skill-behavior/README.md',
  'tests/skill-behavior/scenarios.test.mjs',
  'tests/skill-workflow/browser.mjs',
  'tests/skill-workflow-browser.test.mjs',
  'tests/validate-plugin-manifest.test.js',
];

function update(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`${path}: unchanged`);
    return;
  }
  writeFileSync(path, after);
  console.log(`${path}: updated`);
}

function migrateReferences(text) {
  return text
    .replaceAll('npx playwright install --with-deps chromium', 'set PUPPETEER_EXECUTABLE_PATH to an installed Chrome/Chromium/Edge browser when auto-discovery is unavailable')
    .replaceAll('npx playwright install chromium', 'set PUPPETEER_EXECUTABLE_PATH to an installed Chrome/Chromium/Edge browser when auto-discovery is unavailable')
    .replaceAll('playwright install chromium', 'set PUPPETEER_EXECUTABLE_PATH to an installed Chrome/Chromium/Edge browser when auto-discovery is unavailable')
    .replaceAll("import('playwright').Page", "import('puppeteer-core').Page")
    .replaceAll('bun run ', 'npm run ')
    .replaceAll('bunx ', 'npx ')
    .replaceAll('(?:npx|npx|pnpx)', '(?:npx|pnpx)');
}

for (const file of genericFiles) update(file, migrateReferences);

update('scripts/build-font-index.mjs', (text) => {
  let next = migrateReferences(text);
  next = next.replace("import { createRequire } from 'node:module';\n", '');
  next = next.replace(
    "import { fileURLToPath } from 'node:url';\n",
    "import { fileURLToPath } from 'node:url';\nimport puppeteer from 'puppeteer-core';\n",
  );
  next = next.replace(
    "import { INDEX_PATH, INDEX_SIZES, INDEX_FEATURES, CATEGORIES, packVector } from '../skill/scripts/lib/font-index.mjs';\n",
    "import { INDEX_PATH, INDEX_SIZES, INDEX_FEATURES, CATEGORIES, packVector } from '../skill/scripts/lib/font-index.mjs';\nimport { resolveBrowserExecutable } from './lib/browser-executable.mjs';\n",
  );
  next = next.replace("const require = createRequire(import.meta.url);\n", '');
  next = next.replace(
    "  const pw = require('playwright');\n  const browser = await pw.chromium.launch();\n  const page = await browser.newPage({ viewport: { width: 3000, height: 300 }, deviceScaleFactor: 1 });\n",
    "  const browserArgs = typeof process.getuid === 'function' && process.getuid() === 0\n    ? ['--no-sandbox', '--disable-setuid-sandbox']\n    : [];\n  const browser = await puppeteer.launch({\n    headless: true,\n    executablePath: resolveBrowserExecutable(),\n    args: browserArgs,\n  });\n  const page = await browser.newPage();\n  await page.setViewport({ width: 3000, height: 300, deviceScaleFactor: 1 });\n",
  );
  next = next
    .replaceAll('Playwright Chromium', 'puppeteer-core with host Chrome/Chromium/Edge')
    .replaceAll('Playwright', 'puppeteer-core');
  return next;
});

update('tests/lib/browser-driver.mjs', (text) => {
  let next = text;
  next = next.replace("import { accessSync, constants } from 'node:fs';\nimport { execFileSync } from 'node:child_process';\nimport process from 'node:process';\nimport puppeteer from 'puppeteer-core';\n", "import process from 'node:process';\nimport puppeteer from 'puppeteer-core';\nimport { resolveBrowserExecutable } from '../../scripts/lib/browser-executable.mjs';\n");
  next = next.replace(/\nfunction executableExists[\s\S]*?\nclass ElementAdapter/, '\nclass ElementAdapter');
  if (!next.includes('async isVisible()')) {
    next = next.replace(
      "  async getAttribute(name) {\n    const handle = await this._one();\n    return new ElementAdapter(this.page, handle).getAttribute(name);\n  }\n\n  async waitFor(",
      "  async getAttribute(name) {\n    const handle = await this._one();\n    return new ElementAdapter(this.page, handle).getAttribute(name);\n  }\n\n  async isVisible() {\n    const handles = await this._handles();\n    const selected = this.index == null ? handles[0] : handles[this.index];\n    if (!selected) return false;\n    return selected.evaluate((el) => {\n      const style = getComputedStyle(el);\n      const rect = el.getBoundingClientRect();\n      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;\n    });\n  }\n\n  async waitFor(",
    );
  }
  return next;
});

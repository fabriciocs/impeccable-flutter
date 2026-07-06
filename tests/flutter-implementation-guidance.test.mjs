import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

describe('Flutter implementation guidance', () => {
  it('keeps the core skill Dart-first for Flutter implementation work', () => {
    const source = read('skill/SKILL.src.md');

    assert.match(source, /Treat Flutter as source-first/i);
    assert.match(source, /MaterialApp/);
    assert.match(source, /ThemeData/);
    assert.match(source, /ColorScheme/);
    assert.match(source, /TextTheme/);
    assert.match(source, /loading \/ empty \/ error \/ success states/);
    assert.match(source, /flutter analyze/);
    assert.match(source, /flutter test/);
    assert.match(source, /Flutter Web URL only validates rendered output/i);
  });

  it('requires shape and craft flows to stay Flutter-native', () => {
    const shape = read('skill/reference/shape.md');
    const craft = read('skill/reference/craft.md');
    const init = read('skill/reference/init.md');

    assert.match(shape, /Do not drift into HTML\/CSS as the primary output language for Flutter work/);
    assert.match(shape, /navigation entry points/);
    assert.match(shape, /semantics, and i18n expectations/);

    assert.match(craft, /If found, build in Dart widgets, not HTML\/CSS/);
    assert.match(craft, /Anchor app-level work in the existing `MaterialApp` \/ app shell/);
    assert.match(craft, /Use Flutter Web\/browser inspection only as rendered-output validation/);

    assert.match(init, /multi-page static, or Flutter/);
    assert.match(init, /Treat Flutter Web URLs or `web\/index\.html` as rendered-output evidence only/);
  });

  it('keeps the focused Flutter guidance files free of banned Playwright and Bun references', () => {
    const files = [
      'skill/SKILL.src.md',
      'skill/reference/shape.md',
      'skill/reference/craft.md',
      'skill/reference/init.md',
    ];

    for (const relPath of files) {
      const source = read(relPath);
      assert.doesNotMatch(source, /@playwright\/test|playwright-core|npx playwright|playwright install|ms-playwright/i);
      assert.doesNotMatch(source, /\bbun run\b|\bbun install\b|\bbun:test\b/i);
    }
  });

  it('keeps the manual validation script rg-optional and self-excluding', () => {
    const script = read('scripts/validate-adaptation-to-flutter.ps1');

    assert.match(script, /Get-Command rg -ErrorAction SilentlyContinue/);
    assert.match(script, /Select-String -Path \$files -Pattern \$Pattern -AllMatches/);
    assert.match(script, /\$selfPath = \(Resolve-Path -LiteralPath \$PSCommandPath\)\.Path/);
    assert.match(script, /if \(\$_\.FullName -ne \$selfPath\)/);
  });
});

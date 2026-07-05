import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANTIPATTERNS,
  getRuleEngineSupport,
} from '../cli/engine/registry/antipatterns.mjs';
import { detectDart } from '../cli/engine/engines/flutter-dart/detect-dart.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures', 'flutter');

const EXPECTED_RULES = [
  'flutter-over-rounded-card',
  'flutter-ai-gradient-container',
  'flutter-gradient-text',
  'flutter-hardcoded-text-style',
  'flutter-grey-on-color',
  'flutter-nested-card-container',
  'flutter-missing-semantics-action',
  'flutter-monotonous-padding',
];

function readFixture(name) {
  const file = path.join(FIXTURES, name);
  return {
    file,
    content: readFileSync(file, 'utf-8'),
  };
}

describe('detectDart', () => {
  it('registers every active Flutter/Dart rule with source-engine support', () => {
    const ruleIds = ANTIPATTERNS
      .map((rule) => rule.id)
      .filter((id) => id.startsWith('flutter-'))
      .sort();
    assert.deepEqual(ruleIds, [...EXPECTED_RULES].sort());
    assert.equal(getRuleEngineSupport('flutter-dart').has('source'), true);
  });

  it('flags the bad Flutter fixture with stable rule ids and snippets', () => {
    const { file, content } = readFixture('bad.dart');
    const findings = detectDart(content, file);
    const ids = new Set(findings.map((finding) => finding.antipattern));

    for (const id of EXPECTED_RULES) {
      assert.ok(ids.has(id), `expected ${id} in findings: ${findings.map((f) => f.antipattern).join(', ')}`);
    }

    const snippets = findings.map((finding) => finding.snippet).join('\n');
    assert.match(snippets, /BorderRadius\.circular\(36\)/);
    assert.match(snippets, /LinearGradient purple\/cyan palette/);
    assert.match(snippets, /ShaderMask gradient text/);
    assert.match(snippets, /local TextStyle\(fontSize:\) declarations/);
    assert.match(snippets, /Colors\.grey on colored surface/);
    assert.match(snippets, /Card nested inside Card/);
    assert.match(snippets, /GestureDetector without Semantics or Tooltip/);
    assert.match(snippets, /EdgeInsets\.all\(16\) repeated 4 times/);

    for (const finding of findings) {
      assert.equal(finding.file, file);
      assert.equal(typeof finding.name, 'string');
      assert.equal(typeof finding.description, 'string');
      assert.ok(finding.line > 0, `${finding.antipattern} should include a source line`);
    }
  });

  it('does not flag the good Flutter fixture', () => {
    const { file, content } = readFixture('good.dart');
    const findings = detectDart(content, file);
    assert.deepEqual(findings, []);
  });
});

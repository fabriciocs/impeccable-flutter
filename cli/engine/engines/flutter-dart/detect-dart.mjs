import { finding } from '../../findings.mjs';

const COLORED_SURFACE_RE = /\bColors\.(?:blue|purple|violet|indigo|cyan|teal|green|lime|yellow|amber|orange|deepOrange|red|pink)\b|Color\s*\(\s*0x(?:FF)?(?:[1-9A-F][0-9A-F]{5,7})\s*\)/i;
const AI_GRADIENT_COLOR_RE = /\bColors\.(?:purple|deepPurple|violet|indigo|cyan)\b|0x(?:FF)?(?:8B5CF6|A855F7|7C3AED|6366F1|06B6D4|22D3EE)\b/i;

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function countChar(line, char) {
  return [...line].filter((c) => c === char).length;
}

function contextAround(lines, index, before = 6, after = 8) {
  return lines
    .slice(Math.max(0, index - before), Math.min(lines.length, index + after + 1))
    .join('\n');
}

function pushFinding(findings, seen, id, filePath, snippet, line) {
  const key = `${id}:${snippet}:${line}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push(finding(id, filePath, snippet, line));
}

function checkOverRounded(content, filePath, findings, seen) {
  const lines = content.split('\n');
  const re = /BorderRadius\.circular\(\s*(\d+(?:\.\d+)?)\s*\)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const radius = Number(match[1]);
    if (radius < 32) continue;
    const line = lineNumberAt(content, match.index);
    const context = contextAround(lines, line - 1);
    if (!/(?:Card|Container|InputDecoration|DecoratedBox|Panel)\s*\(|decoration\s*:\s*BoxDecoration\s*\(/.test(context)) continue;
    pushFinding(findings, seen, 'flutter-over-rounded-card', filePath, `BorderRadius.circular(${match[1]})`, line);
  }
}

function checkAiGradientContainer(content, filePath, findings, seen) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/LinearGradient\s*\(/.test(lines[i])) continue;
    const block = contextAround(lines, i, 6, 12);
    if (!AI_GRADIENT_COLOR_RE.test(block)) continue;
    if (!/(?:Container|Card|BoxDecoration|DecoratedBox|Hero)\s*\(/.test(block)) continue;
    pushFinding(findings, seen, 'flutter-ai-gradient-container', filePath, 'LinearGradient purple/cyan palette', i + 1);
  }
}

function checkGradientText(content, filePath, findings, seen) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const block = contextAround(lines, i, 2, 12);
    if (/ShaderMask\s*\(/.test(lines[i]) && /Text\s*\(/.test(block) && /Gradient|createShader|shaderCallback/.test(block)) {
      pushFinding(findings, seen, 'flutter-gradient-text', filePath, 'ShaderMask gradient text', i + 1);
      continue;
    }
    if (/foreground\s*:\s*Paint\s*\(\)\s*\.\.shader/.test(lines[i]) || /TextStyle\s*\([^)]*shader\s*:/.test(block)) {
      pushFinding(findings, seen, 'flutter-gradient-text', filePath, 'TextStyle shader text', i + 1);
    }
  }
}

function checkHardcodedTextStyle(content, filePath, findings, seen) {
  const matches = [...content.matchAll(/TextStyle\s*\([\s\S]{0,160}?fontSize\s*:/g)];
  if (matches.length < 4) return;
  if (/Theme\.of\s*\(\s*context\s*\)\s*\.textTheme/.test(content)) return;
  pushFinding(
    findings,
    seen,
    'flutter-hardcoded-text-style',
    filePath,
    `${matches.length} local TextStyle(fontSize:) declarations`,
    lineNumberAt(content, matches[0].index),
  );
}

function checkGreyOnColor(content, filePath, findings, seen) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/\bColors\.gr[ae]y(?:\s*\[|\b)/.test(lines[i])) continue;
    const context = contextAround(lines, i, 10, 6);
    if (!COLORED_SURFACE_RE.test(context)) continue;
    if (!/(?:Container|ColoredBox|DecoratedBox|Card|Scaffold)\s*\(|color\s*:|decoration\s*:/.test(context)) continue;
    pushFinding(findings, seen, 'flutter-grey-on-color', filePath, 'Colors.grey on colored surface', i + 1);
  }
}

function checkNestedCardContainer(content, filePath, findings, seen) {
  const lines = content.split('\n');
  let depth = 0;
  const cardStack = [];
  const containerStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    while (cardStack.length && depth <= cardStack[cardStack.length - 1].depth) cardStack.pop();
    while (containerStack.length && depth <= containerStack[containerStack.length - 1].depth) containerStack.pop();

    if (/\bCard\s*\(/.test(line)) {
      if (cardStack.length) {
        pushFinding(findings, seen, 'flutter-nested-card-container', filePath, 'Card nested inside Card', i + 1);
      }
      cardStack.push({ depth });
    }

    if (/\bContainer\s*\(/.test(line)) {
      containerStack.push({
        depth,
        parentDecorative: containerStack.some((item) => item.decorative),
        decorative: /decoration\s*:|BoxDecoration\s*\(/.test(line),
      });
    }

    if (/decoration\s*:|BoxDecoration\s*\(/.test(line) && containerStack.length) {
      const current = containerStack[containerStack.length - 1];
      current.decorative = true;
      if (current.parentDecorative) {
        pushFinding(findings, seen, 'flutter-nested-card-container', filePath, 'decorative Container nested inside decorative Container', i + 1);
      }
    }

    depth += countChar(line, '(') - countChar(line, ')');
    if (depth < 0) depth = 0;
  }
}

function checkMissingSemanticsAction(content, filePath, findings, seen) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/\b(?:GestureDetector|InkWell)\s*\(/.test(lines[i])) continue;
    const block = contextAround(lines, i, 4, 16);
    if (/\b(?:Semantics|Tooltip)\s*\(|semanticLabel\s*:|tooltip\s*:|label\s*:/.test(block)) continue;
    const widget = lines[i].match(/\b(GestureDetector|InkWell)\s*\(/)?.[1] || 'custom action';
    pushFinding(findings, seen, 'flutter-missing-semantics-action', filePath, `${widget} without Semantics or Tooltip`, i + 1);
  }
}

function checkMonotonousPadding(content, filePath, findings, seen) {
  const matches = [...content.matchAll(/EdgeInsets\.all\(\s*16(?:\.0)?\s*\)/g)];
  if (matches.length < 4) return;
  pushFinding(
    findings,
    seen,
    'flutter-monotonous-padding',
    filePath,
    `EdgeInsets.all(16) repeated ${matches.length} times`,
    lineNumberAt(content, matches[0].index),
  );
}

function detectDart(content, filePath) {
  const findings = [];
  const seen = new Set();
  checkOverRounded(content, filePath, findings, seen);
  checkAiGradientContainer(content, filePath, findings, seen);
  checkGradientText(content, filePath, findings, seen);
  checkHardcodedTextStyle(content, filePath, findings, seen);
  checkGreyOnColor(content, filePath, findings, seen);
  checkNestedCardContainer(content, filePath, findings, seen);
  checkMissingSemanticsAction(content, filePath, findings, seen);
  checkMonotonousPadding(content, filePath, findings, seen);
  return findings;
}

export { detectDart };

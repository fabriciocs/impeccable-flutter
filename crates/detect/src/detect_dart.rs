//! Flutter/Dart source detector.
//!
//! This ports the Dart-specific detector from the historical
//! `feature/adaptation_to_flutter` branch into the current Rust detector
//! architecture. The browser detector still evaluates rendered Flutter Web
//! output; this module is intentionally source-only.

use std::collections::HashSet;

use impeccable_core::findings::{finding, Finding};
use impeccable_core::registry::{extend, Antipattern};
use once_cell::sync::Lazy;
use regex::Regex;

pub static FLUTTER_RULES: &[Antipattern] = &[
    Antipattern {
        id: "flutter-over-rounded-card",
        category: "slop",
        scopes: Some(&["layout"]),
        severity: None,
        name: "Flutter over-rounded card or panel",
        description: "Flutter card, panel, container, or input uses BorderRadius.circular(32+) — a common generated-UI tell. Use a smaller radius unless the shape is intentionally pill-like.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("avoid BorderRadius.circular(32+) on cards and panels"),
    },
    Antipattern {
        id: "flutter-ai-gradient-container",
        category: "slop",
        scopes: None,
        severity: None,
        name: "Flutter AI gradient container",
        description: "Flutter container or card uses a purple/cyan/violet LinearGradient as decoration. Use a palette from the app theme or remove the generic gradient.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("avoid generic purple/cyan gradients in Flutter surfaces"),
    },
    Antipattern {
        id: "flutter-gradient-text",
        category: "slop",
        scopes: Some(&["type"]),
        severity: None,
        name: "Flutter gradient text",
        description: "ShaderMask or Paint shader is used to create decorative gradient text. Use solid themed text color and hierarchy instead.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("avoid decorative gradient text"),
    },
    Antipattern {
        id: "flutter-hardcoded-text-style",
        category: "quality",
        scopes: Some(&["type"]),
        severity: None,
        name: "Flutter hardcoded TextStyle scale",
        description: "Repeated local TextStyle(fontSize:) declarations bypass ThemeData and TextTheme. Move typography into the app theme or reuse Theme.of(context).textTheme.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("prefer TextTheme over repeated local TextStyle(fontSize:)"),
    },
    Antipattern {
        id: "flutter-grey-on-color",
        category: "quality",
        scopes: None,
        severity: None,
        name: "Flutter grey on colored surface",
        description: "Colors.grey text or icon color appears on an obvious colored Flutter surface. Use ColorScheme roles or a readable shade derived from the surface.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("avoid grey text on colored surfaces"),
    },
    Antipattern {
        id: "flutter-nested-card-container",
        category: "slop",
        scopes: Some(&["layout"]),
        severity: None,
        name: "Flutter nested card/container",
        description: "Decorative cards or containers are nested inside decorative cards or containers. Flatten the hierarchy with spacing, typography, or dividers.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("avoid nested cards and decorative containers"),
    },
    Antipattern {
        id: "flutter-missing-semantics-action",
        category: "quality",
        scopes: None,
        severity: None,
        name: "Flutter custom action missing semantics",
        description: "GestureDetector or InkWell creates a custom action without nearby Semantics, Tooltip, or accessible label. Add semantic intent and focusable affordance.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("custom controls need Semantics, Tooltip, or labels"),
    },
    Antipattern {
        id: "flutter-monotonous-padding",
        category: "slop",
        scopes: Some(&["layout"]),
        severity: None,
        name: "Flutter monotonous padding",
        description: "EdgeInsets.all(16) is repeated through nested Flutter layout. Vary spacing by relationship and use design-system spacing roles.",
        skill_section: Some("Flutter"),
        skill_guideline: Some("avoid repeating identical EdgeInsets at every level"),
    },
];

static OVER_ROUNDED_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"BorderRadius\.circular\(\s*(\d+(?:\.\d+)?)\s*\)").unwrap());
static COLORED_SURFACE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bColors\.(?:blue|purple|violet|indigo|cyan|teal|green|lime|yellow|amber|orange|deepOrange|red|pink)\b|Color\s*\(\s*0x(?:FF)?(?:[1-9A-F][0-9A-F]{5,7})\s*\)").unwrap()
});
static AI_GRADIENT_COLOR_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bColors\.(?:purple|deepPurple|violet|indigo|cyan)\b|0x(?:FF)?(?:8B5CF6|A855F7|7C3AED|6366F1|06B6D4|22D3EE)\b").unwrap()
});
static HARD_CODED_TEXT_STYLE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?s)TextStyle\s*\(.{0,160}?fontSize\s*:").unwrap());
static MONOTONOUS_PADDING_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"EdgeInsets\.all\(\s*16(?:\.0)?\s*\)").unwrap());
static GREY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\bColors\.gr[ae]y(?:\s*\[|\b)").unwrap());
static ACTION_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b(GestureDetector|InkWell)\s*\(").unwrap());

fn line_number_at(content: &str, byte_index: usize) -> usize {
    content[..byte_index.min(content.len())]
        .bytes()
        .filter(|b| *b == b'\n')
        .count()
        + 1
}

fn context_around(lines: &[&str], index: usize, before: usize, after: usize) -> String {
    let start = index.saturating_sub(before);
    let end = (index + after + 1).min(lines.len());
    lines[start..end].join("\n")
}

fn push_finding(
    findings: &mut Vec<Finding>,
    seen: &mut HashSet<String>,
    id: &str,
    file_path: &str,
    snippet: String,
    line: usize,
) {
    let key = format!("{id}:{snippet}:{line}");
    if seen.insert(key) {
        findings.push(finding(id, file_path, &snippet, line as f64));
    }
}

/// Register the source-only Flutter rows in the process registry. `extend`
/// treats repeated installation of this same static slice as a no-op.
pub fn register_flutter_rules() {
    extend(FLUTTER_RULES);
}

/// Detect Flutter/Dart anti-patterns in one source file.
pub fn detect_dart(content: &str, file_path: &str) -> Vec<Finding> {
    register_flutter_rules();

    let mut findings = Vec::new();
    let mut seen = HashSet::new();
    let lines: Vec<&str> = content.split('\n').collect();

    for m in OVER_ROUNDED_RE.captures_iter(content) {
        let radius = m
            .get(1)
            .and_then(|v| v.as_str().parse::<f64>().ok())
            .unwrap_or(0.0);
        if radius < 32.0 {
            continue;
        }
        let whole = m.get(0).unwrap();
        let line = line_number_at(content, whole.start());
        let context = context_around(&lines, line.saturating_sub(1), 6, 8);
        if !(context.contains("Card(")
            || context.contains("Container(")
            || context.contains("InputDecoration(")
            || context.contains("DecoratedBox(")
            || context.contains("Panel(")
            || context.contains("decoration: BoxDecoration("))
        {
            continue;
        }
        push_finding(
            &mut findings,
            &mut seen,
            "flutter-over-rounded-card",
            file_path,
            whole.as_str().to_string(),
            line,
        );
    }

    for (i, line_text) in lines.iter().enumerate() {
        if line_text.contains("LinearGradient(") {
            let block = context_around(&lines, i, 6, 12);
            if AI_GRADIENT_COLOR_RE.is_match(&block)
                && ["Container(", "Card(", "BoxDecoration(", "DecoratedBox(", "Hero("]
                    .iter()
                    .any(|needle| block.contains(needle))
            {
                push_finding(
                    &mut findings,
                    &mut seen,
                    "flutter-ai-gradient-container",
                    file_path,
                    "LinearGradient purple/cyan palette".to_string(),
                    i + 1,
                );
            }
        }

        let block = context_around(&lines, i, 2, 12);
        if (line_text.contains("ShaderMask(")
            && block.contains("Text(")
            && (block.contains("Gradient")
                || block.contains("createShader")
                || block.contains("shaderCallback")))
            || line_text.contains("foreground: Paint()..shader")
            || (block.contains("TextStyle(") && block.contains("shader:"))
        {
            push_finding(
                &mut findings,
                &mut seen,
                "flutter-gradient-text",
                file_path,
                if line_text.contains("ShaderMask(") {
                    "ShaderMask gradient text".to_string()
                } else {
                    "TextStyle shader text".to_string()
                },
                i + 1,
            );
        }

        if GREY_RE.is_match(line_text) {
            let context = context_around(&lines, i, 10, 6);
            if COLORED_SURFACE_RE.is_match(&context)
                && ["Container(", "ColoredBox(", "DecoratedBox(", "Card(", "Scaffold(", "color:", "decoration:"]
                    .iter()
                    .any(|needle| context.contains(needle))
            {
                push_finding(
                    &mut findings,
                    &mut seen,
                    "flutter-grey-on-color",
                    file_path,
                    "Colors.grey on colored surface".to_string(),
                    i + 1,
                );
            }
        }

        if let Some(action) = ACTION_RE.captures(line_text) {
            let block = context_around(&lines, i, 4, 16);
            if !(block.contains("Semantics(")
                || block.contains("Tooltip(")
                || block.contains("semanticLabel:")
                || block.contains("tooltip:")
                || block.contains("label:"))
            {
                let widget = action.get(1).map(|m| m.as_str()).unwrap_or("custom action");
                push_finding(
                    &mut findings,
                    &mut seen,
                    "flutter-missing-semantics-action",
                    file_path,
                    format!("{widget} without Semantics or Tooltip"),
                    i + 1,
                );
            }
        }
    }

    let hardcoded: Vec<_> = HARD_CODED_TEXT_STYLE_RE.find_iter(content).collect();
    if hardcoded.len() >= 4 && !content.contains("Theme.of(context).textTheme") {
        push_finding(
            &mut findings,
            &mut seen,
            "flutter-hardcoded-text-style",
            file_path,
            format!("{} local TextStyle(fontSize:) declarations", hardcoded.len()),
            line_number_at(content, hardcoded[0].start()),
        );
    }

    let padding: Vec<_> = MONOTONOUS_PADDING_RE.find_iter(content).collect();
    if padding.len() >= 4 {
        push_finding(
            &mut findings,
            &mut seen,
            "flutter-monotonous-padding",
            file_path,
            format!("EdgeInsets.all(16) repeated {} times", padding.len()),
            line_number_at(content, padding[0].start()),
        );
    }

    let mut depth: i32 = 0;
    let mut card_depths: Vec<i32> = Vec::new();
    let mut container_stack: Vec<(i32, bool)> = Vec::new();
    for (i, line_text) in lines.iter().enumerate() {
        while card_depths.last().is_some_and(|d| depth <= *d) {
            card_depths.pop();
        }
        while container_stack
            .last()
            .is_some_and(|(container_depth, _)| depth <= *container_depth)
        {
            container_stack.pop();
        }

        if line_text.contains("Card(") {
            if !card_depths.is_empty() {
                push_finding(
                    &mut findings,
                    &mut seen,
                    "flutter-nested-card-container",
                    file_path,
                    "Card nested inside Card".to_string(),
                    i + 1,
                );
            }
            card_depths.push(depth);
        }

        if line_text.contains("Container(") {
            let decorative = line_text.contains("decoration:") || line_text.contains("BoxDecoration(");
            let parent_decorative = container_stack.iter().any(|(_, d)| *d);
            if decorative && parent_decorative {
                push_finding(
                    &mut findings,
                    &mut seen,
                    "flutter-nested-card-container",
                    file_path,
                    "decorative Container nested inside decorative Container".to_string(),
                    i + 1,
                );
            }
            container_stack.push((depth, decorative));
        }

        if (line_text.contains("decoration:") || line_text.contains("BoxDecoration("))
            && !container_stack.is_empty()
        {
            let parent_decorative = container_stack
                .iter()
                .take(container_stack.len().saturating_sub(1))
                .any(|(_, d)| *d);
            if let Some((_, decorative)) = container_stack.last_mut() {
                *decorative = true;
            }
            if parent_decorative {
                push_finding(
                    &mut findings,
                    &mut seen,
                    "flutter-nested-card-container",
                    file_path,
                    "decorative Container nested inside decorative Container".to_string(),
                    i + 1,
                );
            }
        }

        depth += line_text.chars().filter(|c| *c == '(').count() as i32;
        depth -= line_text.chars().filter(|c| *c == ')').count() as i32;
        depth = depth.max(0);
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    const BAD: &str = r#"
import 'package:flutter/material.dart';
Widget build(BuildContext context) {
  return Container(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(40),
      gradient: const LinearGradient(colors: [Colors.purple, Colors.cyan]),
    ),
    padding: const EdgeInsets.all(16),
    child: Card(
      child: Card(
        child: ShaderMask(
          shaderCallback: (bounds) => const LinearGradient(colors: [Colors.purple, Colors.cyan]).createShader(bounds),
          child: Text('Title', style: TextStyle(fontSize: 42)),
        ),
      ),
    ),
  );
}
final a = TextStyle(fontSize: 12);
final b = TextStyle(fontSize: 14);
final c = TextStyle(fontSize: 16);
final d = TextStyle(fontSize: 18);
final p1 = EdgeInsets.all(16);
final p2 = EdgeInsets.all(16);
final p3 = EdgeInsets.all(16);
final p4 = EdgeInsets.all(16);
final action = GestureDetector(onTap: () {}, child: const Icon(Icons.add));
"#;

    const GOOD: &str = r#"
import 'package:flutter/material.dart';
Widget build(BuildContext context) {
  final textTheme = Theme.of(context).textTheme;
  return Semantics(
    button: true,
    label: 'Add item',
    child: InkWell(
      onTap: () {},
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Text('Add', style: textTheme.labelLarge),
      ),
    ),
  );
}
"#;

    #[test]
    fn bad_fixture_has_flutter_findings() {
        let findings = detect_dart(BAD, "/app/lib/main.dart");
        assert!(findings.len() >= 6, "{findings:?}");
        assert!(findings.iter().all(|f| f.antipattern.starts_with("flutter-")));
        assert!(findings.iter().any(|f| f.antipattern == "flutter-over-rounded-card"));
        assert!(findings.iter().any(|f| f.antipattern == "flutter-ai-gradient-container"));
        assert!(findings.iter().any(|f| f.antipattern == "flutter-gradient-text"));
        assert!(findings.iter().any(|f| f.antipattern == "flutter-hardcoded-text-style"));
        assert!(findings.iter().any(|f| f.antipattern == "flutter-monotonous-padding"));
        assert!(findings.iter().any(|f| f.antipattern == "flutter-missing-semantics-action"));
    }

    #[test]
    fn good_fixture_stays_clean() {
        assert!(detect_dart(GOOD, "/app/lib/good.dart").is_empty());
    }
}

//! Flutter/Dart source detector.
//!
//! The browser detector evaluates rendered Flutter Web output. This module is
//! intentionally source-only and keeps the public Flutter rule IDs stable.
//! It uses balanced Dart call spans rather than fixed line windows so a widget
//! can be formatted across many lines without losing its structural context.

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

static CALL_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(").expect("valid Dart call regex")
});
static OVER_ROUNDED_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"BorderRadius\.circular\(\s*(\d+(?:\.\d+)?)\s*\)").unwrap());
static COLORED_SURFACE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bColors\.(?:blue|purple|violet|indigo|cyan|teal|green|lime|yellow|amber|orange|deepOrange|red|pink)\b|Color\s*\(\s*0x(?:FF)?(?:[1-9A-F][0-9A-F]{5,7})\s*\)").unwrap()
});
static AI_GRADIENT_COLOR_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bColors\.(?:purple|deepPurple|violet|indigo|cyan)\b|0x(?:FF)?(?:8B5CF6|A855F7|7C3AED|6366F1|06B6D4|22D3EE)\b").unwrap()
});
static MONOTONOUS_PADDING_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"EdgeInsets\.all\(\s*16(?:\.0)?\s*\)").unwrap());
static GREY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\bColors\.gr[ae]y(?:\s*\[|\b)").unwrap());

#[derive(Debug, Clone)]
struct CallSpan {
    name: String,
    start: usize,
    open: usize,
    end: usize,
}

fn line_number_at(content: &str, byte_index: usize) -> usize {
    content[..byte_index.min(content.len())]
        .bytes()
        .filter(|b| *b == b'\n')
        .count()
        + 1
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

/// Replace comments and string literal bytes with spaces while preserving byte
/// offsets and newlines. Structural scanning can therefore ignore examples in
/// comments/strings without needing a full Dart parser.
fn structural_source(content: &str) -> String {
    const CODE: u8 = 0;
    const LINE_COMMENT: u8 = 1;
    const BLOCK_COMMENT: u8 = 2;
    const SINGLE: u8 = 3;
    const DOUBLE: u8 = 4;
    const TRIPLE_SINGLE: u8 = 5;
    const TRIPLE_DOUBLE: u8 = 6;

    let input = content.as_bytes();
    let mut out = input.to_vec();
    let mut state = CODE;
    let mut i = 0;

    while i < input.len() {
        let next = |offset: usize| input.get(i + offset).copied();
        match state {
            CODE => {
                if input[i] == b'/' && next(1) == Some(b'/') {
                    out[i] = b' ';
                    out[i + 1] = b' ';
                    state = LINE_COMMENT;
                    i += 2;
                    continue;
                }
                if input[i] == b'/' && next(1) == Some(b'*') {
                    out[i] = b' ';
                    out[i + 1] = b' ';
                    state = BLOCK_COMMENT;
                    i += 2;
                    continue;
                }
                if input[i] == b'\'' && next(1) == Some(b'\'') && next(2) == Some(b'\'') {
                    out[i] = b' ';
                    out[i + 1] = b' ';
                    out[i + 2] = b' ';
                    state = TRIPLE_SINGLE;
                    i += 3;
                    continue;
                }
                if input[i] == b'"' && next(1) == Some(b'"') && next(2) == Some(b'"') {
                    out[i] = b' ';
                    out[i + 1] = b' ';
                    out[i + 2] = b' ';
                    state = TRIPLE_DOUBLE;
                    i += 3;
                    continue;
                }
                if input[i] == b'\'' {
                    out[i] = b' ';
                    state = SINGLE;
                } else if input[i] == b'"' {
                    out[i] = b' ';
                    state = DOUBLE;
                }
                i += 1;
            }
            LINE_COMMENT => {
                if input[i] == b'\n' {
                    state = CODE;
                } else {
                    out[i] = b' ';
                }
                i += 1;
            }
            BLOCK_COMMENT => {
                if input[i] == b'*' && next(1) == Some(b'/') {
                    out[i] = b' ';
                    out[i + 1] = b' ';
                    state = CODE;
                    i += 2;
                } else {
                    if input[i] != b'\n' {
                        out[i] = b' ';
                    }
                    i += 1;
                }
            }
            SINGLE | DOUBLE => {
                let quote = if state == SINGLE { b'\'' } else { b'"' };
                if input[i] == b'\\' {
                    out[i] = b' ';
                    if i + 1 < input.len() {
                        if input[i + 1] != b'\n' {
                            out[i + 1] = b' ';
                        }
                        i += 2;
                    } else {
                        i += 1;
                    }
                } else if input[i] == quote {
                    out[i] = b' ';
                    state = CODE;
                    i += 1;
                } else {
                    if input[i] != b'\n' {
                        out[i] = b' ';
                    }
                    i += 1;
                }
            }
            TRIPLE_SINGLE | TRIPLE_DOUBLE => {
                let quote = if state == TRIPLE_SINGLE { b'\'' } else { b'"' };
                if input[i] == quote && next(1) == Some(quote) && next(2) == Some(quote) {
                    out[i] = b' ';
                    out[i + 1] = b' ';
                    out[i + 2] = b' ';
                    state = CODE;
                    i += 3;
                } else {
                    if input[i] != b'\n' {
                        out[i] = b' ';
                    }
                    i += 1;
                }
            }
            _ => unreachable!(),
        }
    }

    String::from_utf8(out).unwrap_or_else(|_| content.to_string())
}

fn matching_paren(source: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0usize;
    for (offset, byte) in source.iter().enumerate().skip(open) {
        match byte {
            b'(' => depth += 1,
            b')' => {
                depth = depth.checked_sub(1)?;
                if depth == 0 {
                    return Some(offset + 1);
                }
            }
            _ => {}
        }
    }
    None
}

fn find_calls(source: &str) -> Vec<CallSpan> {
    let bytes = source.as_bytes();
    let mut calls = Vec::new();
    for capture in CALL_RE.captures_iter(source) {
        let Some(whole) = capture.get(0) else { continue };
        let Some(name) = capture.get(1) else { continue };
        let open = whole.end().saturating_sub(1);
        let Some(end) = matching_paren(bytes, open) else { continue };
        calls.push(CallSpan {
            name: name.as_str().to_string(),
            start: whole.start(),
            open,
            end,
        });
    }
    calls
}

fn call_body<'a>(source: &'a str, call: &CallSpan) -> &'a str {
    if call.open + 1 >= call.end.saturating_sub(1) {
        ""
    } else {
        &source[call.open + 1..call.end - 1]
    }
}

fn encloses(call: &CallSpan, position: usize) -> bool {
    call.start <= position && position < call.end
}

fn nearest_enclosing<'a>(
    calls: &'a [CallSpan],
    position: usize,
    names: &[&str],
) -> Option<&'a CallSpan> {
    calls
        .iter()
        .filter(|call| encloses(call, position) && names.contains(&call.name.as_str()))
        .min_by_key(|call| call.end.saturating_sub(call.start))
}

fn is_decorative_surface(source: &str, call: &CallSpan) -> bool {
    match call.name.as_str() {
        "Card" | "DecoratedBox" | "InputDecoration" | "Panel" => true,
        "Container" => {
            let body = call_body(source, call);
            body.contains("decoration:") || body.contains("color:")
        }
        _ => false,
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

    let structural = structural_source(content);
    let calls = find_calls(&structural);
    let mut findings = Vec::new();
    let mut seen = HashSet::new();

    for capture in OVER_ROUNDED_RE.captures_iter(&structural) {
        let radius = capture
            .get(1)
            .and_then(|value| value.as_str().parse::<f64>().ok())
            .unwrap_or(0.0);
        if radius < 32.0 {
            continue;
        }
        let whole = capture.get(0).unwrap();
        if nearest_enclosing(
            &calls,
            whole.start(),
            &["Card", "Container", "InputDecoration", "DecoratedBox", "Panel"],
        )
        .is_none()
        {
            continue;
        }
        push_finding(
            &mut findings,
            &mut seen,
            "flutter-over-rounded-card",
            file_path,
            content[whole.start()..whole.end()].to_string(),
            line_number_at(content, whole.start()),
        );
    }

    for gradient in calls.iter().filter(|call| call.name == "LinearGradient") {
        let body = call_body(&structural, gradient);
        if !AI_GRADIENT_COLOR_RE.is_match(body) {
            continue;
        }
        if nearest_enclosing(
            &calls,
            gradient.start,
            &["Container", "Card", "BoxDecoration", "DecoratedBox", "Hero"],
        )
        .is_some()
        {
            push_finding(
                &mut findings,
                &mut seen,
                "flutter-ai-gradient-container",
                file_path,
                "LinearGradient purple/cyan palette".to_string(),
                line_number_at(content, gradient.start),
            );
        }
    }

    for shader in calls.iter().filter(|call| call.name == "ShaderMask") {
        let body = call_body(&structural, shader);
        if body.contains("Text(") && (body.contains("Gradient") || body.contains("createShader")) {
            push_finding(
                &mut findings,
                &mut seen,
                "flutter-gradient-text",
                file_path,
                "ShaderMask gradient text".to_string(),
                line_number_at(content, shader.start),
            );
        }
    }
    for style in calls.iter().filter(|call| call.name == "TextStyle") {
        let body = call_body(&structural, style);
        if (body.contains("foreground:") && body.contains("shader")) || body.contains("shader:") {
            push_finding(
                &mut findings,
                &mut seen,
                "flutter-gradient-text",
                file_path,
                "TextStyle shader text".to_string(),
                line_number_at(content, style.start),
            );
        }
    }

    for grey in GREY_RE.find_iter(&structural) {
        let Some(surface) = nearest_enclosing(
            &calls,
            grey.start(),
            &["Container", "ColoredBox", "DecoratedBox", "Card", "Scaffold"],
        ) else {
            continue;
        };
        if COLORED_SURFACE_RE.is_match(call_body(&structural, surface)) {
            push_finding(
                &mut findings,
                &mut seen,
                "flutter-grey-on-color",
                file_path,
                "Colors.grey on colored surface".to_string(),
                line_number_at(content, grey.start()),
            );
        }
    }

    for action in calls
        .iter()
        .filter(|call| matches!(call.name.as_str(), "GestureDetector" | "InkWell"))
    {
        let body = call_body(&structural, action);
        let has_local_accessibility = body.contains("semanticLabel:")
            || body.contains("tooltip:")
            || body.contains("label:")
            || body.contains("IconButton(")
            || body.contains("TextButton(")
            || body.contains("ElevatedButton(")
            || body.contains("FilledButton(")
            || body.contains("OutlinedButton(");
        let wrapped_accessibly = calls.iter().any(|parent| {
            parent.start < action.start
                && parent.end >= action.end
                && matches!(parent.name.as_str(), "Semantics" | "Tooltip")
        });
        if !has_local_accessibility && !wrapped_accessibly {
            push_finding(
                &mut findings,
                &mut seen,
                "flutter-missing-semantics-action",
                file_path,
                format!("{} without Semantics or Tooltip", action.name),
                line_number_at(content, action.start),
            );
        }
    }

    let hardcoded: Vec<&CallSpan> = calls
        .iter()
        .filter(|call| call.name == "TextStyle" && call_body(&structural, call).contains("fontSize:"))
        .filter(|style| {
            nearest_enclosing(&calls, style.start, &["ThemeData", "TextTheme"]).is_none()
        })
        .collect();
    let defines_theme_extension = structural.contains("extends ThemeExtension");
    if hardcoded.len() >= 4
        && !structural.contains("Theme.of(context).textTheme")
        && !defines_theme_extension
    {
        push_finding(
            &mut findings,
            &mut seen,
            "flutter-hardcoded-text-style",
            file_path,
            format!("{} local TextStyle(fontSize:) declarations", hardcoded.len()),
            line_number_at(content, hardcoded[0].start),
        );
    }

    let padding: Vec<_> = MONOTONOUS_PADDING_RE.find_iter(&structural).collect();
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

    let decorative: Vec<&CallSpan> = calls
        .iter()
        .filter(|call| is_decorative_surface(&structural, call))
        .collect();
    for inner in &decorative {
        let parent = decorative
            .iter()
            .copied()
            .filter(|outer| outer.start < inner.start && outer.end >= inner.end)
            .min_by_key(|outer| outer.end.saturating_sub(outer.start));
        if let Some(parent) = parent {
            push_finding(
                &mut findings,
                &mut seen,
                "flutter-nested-card-container",
                file_path,
                format!("{} nested inside {}", inner.name, parent.name),
                line_number_at(content, inner.start),
            );
        }
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

    #[test]
    fn comments_and_strings_do_not_create_findings() {
        let source = r#"
// GestureDetector(onTap: () {})
final sample = 'Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(60)))';
"#;
        assert!(detect_dart(source, "/app/lib/sample.dart").is_empty());
    }

    #[test]
    fn large_radius_outside_a_surface_is_not_flagged() {
        let source = r#"
final clip = ClipRRect(
  borderRadius: BorderRadius.circular(40),
  child: const SizedBox(width: 80, height: 80),
);
"#;
        let findings = detect_dart(source, "/app/lib/avatar.dart");
        assert!(!findings
            .iter()
            .any(|f| f.antipattern == "flutter-over-rounded-card"));
    }

    #[test]
    fn distant_semantics_wrapper_protects_custom_action() {
        let source = r#"
return Semantics(
  button: true,
  label: 'Open details',
  child: Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Column(
      children: [
        const Text('Details'),
        const SizedBox(height: 24),
        InkWell(
          onTap: onTap,
          child: const Icon(Icons.open_in_new),
        ),
      ],
    ),
  ),
);
"#;
        let findings = detect_dart(source, "/app/lib/action.dart");
        assert!(!findings
            .iter()
            .any(|f| f.antipattern == "flutter-missing-semantics-action"));
    }

    #[test]
    fn theme_data_text_styles_are_not_counted_as_local_scale() {
        let source = r#"
final theme = ThemeData(
  textTheme: const TextTheme(
    displayLarge: TextStyle(fontSize: 48),
    headlineLarge: TextStyle(fontSize: 32),
    titleLarge: TextStyle(fontSize: 22),
    bodyLarge: TextStyle(fontSize: 16),
  ),
);
"#;
        let findings = detect_dart(source, "/app/lib/theme.dart");
        assert!(!findings
            .iter()
            .any(|f| f.antipattern == "flutter-hardcoded-text-style"));
    }

    #[test]
    fn decorative_nested_surfaces_are_structurally_detected() {
        let source = r#"
return Container(
  decoration: const BoxDecoration(color: Colors.white),
  child: Padding(
    padding: const EdgeInsets.all(8),
    child: Container(
      decoration: const BoxDecoration(color: Colors.blue),
      child: const Text('Nested'),
    ),
  ),
);
"#;
        let findings = detect_dart(source, "/app/lib/nested.dart");
        assert!(findings
            .iter()
            .any(|f| f.antipattern == "flutter-nested-card-container"));
    }
}

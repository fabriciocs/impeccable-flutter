//! Compatibility wrapper around the current text detector that adds Dart.
//!
//! Keeping the upstream text engine intact makes the Flutter port resilient to
//! upstream detector changes: every non-Dart source still executes the exact
//! existing implementation.

#[path = "detect_text.rs"]
mod upstream;

pub use upstream::{ext_from_file_path, run_text_content_analyzers, TextOptions};

use impeccable_core::findings::Finding;
use impeccable_core::inline_ignores::apply_inline_ignores;

fn looks_like_dart_stdin(content: &str) -> bool {
    let source = content.trim_start();
    source.contains("package:flutter/")
        || source.contains("import 'dart:")
        || source.contains("import \"dart:")
        || (source.contains("void main(")
            && (source.contains("runApp(")
                || source.contains("Widget")
                || source.contains("MaterialApp(")
                || source.contains("CupertinoApp(")))
}

/// Current text detector plus Flutter/Dart source dispatch.
pub fn detect_text(content: &str, file_path: &str, options: &TextOptions) -> Vec<Finding> {
    let ext = upstream::ext_from_file_path(file_path);
    let dart_stdin = file_path == "<stdin>" && looks_like_dart_stdin(content);
    if ext != ".dart" && !dart_stdin {
        return upstream::detect_text(content, file_path, options);
    }

    let mut findings = crate::detect_dart::detect_dart(content, file_path);

    // Preserve the detector extension point on Dart files and inferred Dart
    // stdin. Rule packs see `.dart` so their extension routing is stable.
    if let Some(pack) = options.rule_pack {
        let effective_ext = if dart_stdin { ".dart" } else { ext.as_str() };
        findings.extend(pack.check_text(content, file_path, effective_ext));
    }

    if options.inline_ignores {
        apply_inline_ignores(findings, Some(content))
    } else {
        findings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flutter_stdin_uses_dart_detector() {
        let source = "import 'package:flutter/material.dart';\nvoid main() => runApp(Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(40))));\n";
        let findings = detect_text(source, "<stdin>", &TextOptions::default());
        assert!(findings.iter().any(|finding| finding.antipattern == "flutter-over-rounded-card"), "{findings:#?}");
    }

    #[test]
    fn ordinary_stdin_keeps_upstream_dispatch() {
        let source = "const value = 'not Dart';\n";
        let findings = detect_text(source, "<stdin>", &TextOptions::default());
        assert!(findings.iter().all(|finding| !finding.antipattern.starts_with("flutter-")));
    }
}

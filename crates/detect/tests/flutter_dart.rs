use impeccable_detect::detect_text::{detect_text, TextOptions};
use impeccable_detect::file_system::has_scannable_extension;

const BAD: &str = include_str!("fixtures/flutter/bad.dart");
const GOOD: &str = include_str!("fixtures/flutter/good.dart");

fn scan(source: &str, path: &str) -> Vec<impeccable_core::findings::Finding> {
    detect_text(
        source,
        path,
        &TextOptions {
            inline_ignores: true,
            ..Default::default()
        },
    )
}

#[test]
fn dart_extension_is_part_of_directory_scanning() {
    assert!(has_scannable_extension("main.dart"));
    assert!(has_scannable_extension("widget.DART"));
    assert!(has_scannable_extension("index.html"));
}

#[test]
fn public_text_engine_dispatches_dart_to_flutter_rules() {
    let findings = scan(BAD, "/fixture/lib/bad.dart");
    assert!(findings.len() >= 6, "{findings:#?}");
    assert!(findings
        .iter()
        .all(|finding| finding.antipattern.starts_with("flutter-")));
}

#[test]
fn clean_flutter_fixture_has_no_findings() {
    let findings = scan(GOOD, "/fixture/lib/good.dart");
    assert!(findings.is_empty(), "{findings:#?}");
}

#[test]
fn dart_inline_ignore_is_honored() {
    let source = r#"
// impeccable-disable-next-line flutter-missing-semantics-action: custom control has external semantics
final action = GestureDetector(onTap: () {}, child: const Icon(Icons.add));
"#;
    let findings = scan(source, "/fixture/lib/ignored.dart");
    assert!(findings.is_empty(), "{findings:#?}");
}

#[test]
fn flutter_stdin_is_dispatched_to_dart_rules() {
    let source = r#"
import 'package:flutter/material.dart';
void main() => runApp(Container(
  decoration: BoxDecoration(borderRadius: BorderRadius.circular(40)),
));
"#;
    let findings = scan(source, "<stdin>");
    assert!(
        findings
            .iter()
            .any(|finding| finding.antipattern == "flutter-over-rounded-card"),
        "{findings:#?}"
    );
}

#[test]
fn dart_only_source_does_not_become_flutter_by_extension_alone() {
    let source = r#"
import 'dart:convert';
void main() { print(jsonEncode({'ok': true})); }
"#;
    let findings = scan(source, "/fixture/lib/tool.dart");
    assert!(findings.is_empty(), "{findings:#?}");
}

#[test]
fn windows_and_posix_paths_have_identical_flutter_results() {
    let source = r#"
import 'package:flutter/material.dart';
final action = GestureDetector(onTap: () {}, child: const Icon(Icons.add));
"#;
    let posix = scan(source, "/workspace/lib/action.dart");
    let windows = scan(source, r"C:\workspace\lib\action.dart");
    let posix_ids: Vec<_> = posix.iter().map(|finding| finding.antipattern.as_str()).collect();
    let windows_ids: Vec<_> = windows
        .iter()
        .map(|finding| finding.antipattern.as_str())
        .collect();
    assert_eq!(posix_ids, windows_ids);
}

#[test]
fn one_source_match_is_not_duplicated_by_flutter_dispatch() {
    let source = r#"
import 'package:flutter/material.dart';
final action = GestureDetector(onTap: () {}, child: const Icon(Icons.add));
"#;
    let findings = scan(source, "/fixture/lib/action.dart");
    let count = findings
        .iter()
        .filter(|finding| finding.antipattern == "flutter-missing-semantics-action")
        .count();
    assert_eq!(count, 1, "{findings:#?}");
}

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

//! Flutter-aware compatibility layer around the upstream context CLI.
//!
//! Upstream output is preserved verbatim, then the resolved context is
//! enriched with a technology/framework axis that is independent of platform.
//! This keeps Android/iOS/adaptive Flutter projects eligible for Dart source
//! scanning without changing the meaning of `platform`.

#[path = "context_cli_upstream.rs"]
mod upstream;

pub use upstream::*;

use crate::context;
use crate::provider;
use crate::target_args::parse_target_options;
use impeccable_common::flutter::{find_nearest_dart_project, technology_name, DartProjectInfo};
use impeccable_common::Io;
use std::cell::RefCell;
use std::io::Write;
use std::path::PathBuf;
use std::rc::Rc;

struct Capture(Rc<RefCell<Vec<u8>>>);

impl Write for Capture {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.0.borrow_mut().extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn project_info(args: &[String], io: &Io) -> Option<DartProjectInfo> {
    let cwd = io.cwd.to_string_lossy().into_owned();
    let env = io.env.clone();
    let options = parse_target_options(args, true).ok()?;
    let target = options
        .target_path
        .as_deref()
        .map(|path| context::resolve_target_path(&cwd, path, &env))
        .unwrap_or_else(|| {
            context::resolve_project(&cwd, &options, &env).project_root
        });
    find_nearest_dart_project(PathBuf::from(target))
}

fn enrich_resolved_context(mut text: String, info: &DartProjectInfo) -> String {
    if text.contains("\"technology\"") {
        return text;
    }
    let Some(marker) = text.find("RESOLVED_CONTEXT:\n") else {
        return text;
    };
    let search_from = marker + "RESOLVED_CONTEXT:\n".len();
    let Some(relative) = text[search_from..].find("  \"platform\":") else {
        return text;
    };
    let insert_at = search_from + relative;
    let framework = if info.is_flutter { "\"flutter\"" } else { "null" };
    let fields = format!(
        "  \"technology\": \"{}\",\n  \"framework\": {},\n",
        technology_name(info),
        framework
    );
    text.insert_str(insert_at, &fields);
    text
}

fn neutralize_web_only_detector_copy(mut text: String, info: &DartProjectInfo) -> String {
    if !info.is_flutter {
        return text;
    }
    text = text.replace(
        "Once the changed web UI is finished, run the mechanical detector over it:",
        "Once the changed Flutter/Dart UI is finished, run the mechanical source detector over changed Dart targets:",
    );
    text
}

pub fn build_resolved_context_directive(
    ctx: &context::Ctx,
    options: &crate::target_args::TargetOptions,
    target_exists: Option<bool>,
) -> String {
    let base = upstream::build_resolved_context_directive(ctx, options, target_exists);
    match find_nearest_dart_project(PathBuf::from(&ctx.project_root)) {
        Some(info) => enrich_resolved_context(base, &info),
        None => base,
    }
}

pub fn run(args: &[String], io: &mut Io) -> i32 {
    let captured = Rc::new(RefCell::new(Vec::new()));
    let original_stdout = std::mem::replace(&mut io.stdout, Box::new(Capture(captured.clone())));
    let code = upstream::run(args, io);
    io.stdout = original_stdout;

    let mut output = String::from_utf8_lossy(&captured.borrow()).into_owned();
    let info = if code == 0 { project_info(args, io) } else { None };
    if let Some(info) = info.as_ref() {
        output = enrich_resolved_context(output, info);
        output = neutralize_web_only_detector_copy(output, info);
    }
    io.out(&output);

    let Some(info) = info else {
        return code;
    };
    if !info.is_flutter {
        return code;
    }

    let cwd = io.cwd.to_string_lossy().into_owned();
    let provider = provider::detect(&io.env, &cwd);
    let detect_cmd = provider.verb_cmd("detect");
    let mut directives = Vec::new();
    directives.push(format!(
        "FLUTTER_SOURCE_SCAN: Technology is Flutter. Validate Dart source with `{} --json <changed .dart targets>` or a Flutter source directory such as `lib/`. Rendered Flutter Web URL scanning is a separate optional evidence channel and never replaces Dart analysis; no dev-server port is inferred.",
        detect_cmd
    ));
    directives.push(
        "FLUTTER_REFERENCE_REQUIRED: Load reference/flutter.md for Flutter UI work. Keep Material/Cupertino/custom design-system guidance subordinate to the product's actual design authority and supported platforms.".to_string(),
    );
    if !output.contains("MANUAL_DETECTOR_REQUIRED") {
        directives.push(format!(
            "MANUAL_DETECTOR_REQUIRED: No automatic Flutter/Dart source detector coverage is established for this native session. Once the changed Flutter UI is finished, run `{} --json <changed .dart targets>` once.",
            detect_cmd
        ));
    }
    io.out(&format!("\n---\n\n{}\n", directives.join("\n\n---\n\n")));
    code
}

#[cfg(test)]
mod flutter_context_cli_tests {
    use super::*;
    use std::collections::HashMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "impeccable-context-cli-flutter-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(root.join("lib")).unwrap();
        std::fs::write(
            root.join("pubspec.yaml"),
            "name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n",
        )
        .unwrap();
        std::fs::write(root.join("lib/main.dart"), "void main() {}\n").unwrap();
        root
    }

    #[test]
    fn resolved_context_exposes_flutter_separately_from_platform() {
        let root = temp();
        std::fs::write(
            root.join("PRODUCT.md"),
            "# Product\n\n## Platform\nandroid\n",
        )
        .unwrap();
        let (mut io, captured) = Io::captured("", root.clone(), HashMap::new());
        let code = run(&[], &mut io);
        assert_eq!(code, 0);
        let output = String::from_utf8_lossy(&captured.stdout.borrow()).into_owned();
        assert!(output.contains("\"technology\": \"flutter\""), "{output}");
        assert!(output.contains("\"framework\": \"flutter\""), "{output}");
        assert!(output.contains("\"platform\": \"android\""), "{output}");
        assert!(output.contains("FLUTTER_SOURCE_SCAN"), "{output}");
        let _ = std::fs::remove_dir_all(root);
    }
}

//! Compatibility wrapper around the current text detector that adds Dart.
//!
//! Keeping the upstream text engine intact makes the Flutter port resilient to
//! upstream detector changes: every non-Dart source still executes the exact
//! existing implementation.

#[path = "detect_text.rs"]
mod upstream;

pub use upstream::TextOptions;

use impeccable_core::findings::Finding;
use impeccable_core::inline_ignores::apply_inline_ignores;

/// Current text detector plus Flutter/Dart source dispatch.
pub fn detect_text(content: &str, file_path: &str, options: &TextOptions) -> Vec<Finding> {
    let ext = upstream::ext_from_file_path(file_path);
    if ext != ".dart" {
        return upstream::detect_text(content, file_path, options);
    }

    let mut findings = crate::detect_dart::detect_dart(content, file_path);

    // Preserve the detector extension point on Dart files too.
    if let Some(pack) = options.rule_pack {
        findings.extend(pack.check_text(content, file_path, &ext));
    }

    if options.inline_ignores {
        apply_inline_ignores(findings, Some(content))
    } else {
        findings
    }
}

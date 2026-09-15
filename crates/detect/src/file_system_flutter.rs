//! Compatibility wrapper around the upstream filesystem detector.
//!
//! The upstream implementation remains the source of truth for web framework
//! behavior. This layer only widens directory discovery to Dart and exposes
//! Flutter project metadata for callers that need to explain source-vs-browser
//! scanning.

#[path = "file_system.rs"]
mod upstream;

pub use upstream::{
    build_import_graph, build_import_graph_reporting, detect_framework_config, is_html_path,
    is_port_listening, resolve_import, DetectedFramework, Fingerprint, FrameworkConfig,
    PortProbe, FRAMEWORK_CONFIGS, HIDDEN_SOURCE_DIRS, HTML_EXTENSIONS, SKIP_DIRS,
};

pub const DART_EXTENSIONS: &[&str] = &[".dart"];

/// Upstream scannable source extensions plus Dart.
pub const SCANNABLE_EXTENSIONS: &[&str] = &[
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".jsx",
    ".tsx",
    ".js",
    ".ts",
    ".vue",
    ".svelte",
    ".astro",
    ".blade.php",
    ".dart",
];

pub fn has_scannable_extension(filename: &str) -> bool {
    let lower = impeccable_core::js::to_lower_case(filename);
    if SCANNABLE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(ext))
    {
        return true;
    }
    false
}

pub fn walk_dir(dir: &str) -> Vec<String> {
    walk_dir_reporting(dir, &mut |_, _| {})
}

/// Upstream walker semantics with `.dart` included.
pub fn walk_dir_reporting(
    dir: &str,
    on_read_error: &mut dyn FnMut(&str, &std::io::Error),
) -> Vec<String> {
    let mut files = Vec::new();
    let rd = match std::fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(e) => {
            on_read_error(dir, &e);
            return files;
        }
    };
    let mut entries: Vec<(String, bool)> = Vec::new();
    for entry in rd.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        entries.push((name, is_dir));
    }
    entries.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));
    for (name, is_dir) in entries {
        if SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }
        if is_dir && name.starts_with('.') && !HIDDEN_SOURCE_DIRS.contains(&name.as_str()) {
            continue;
        }
        let full = crate::jsp::join(&[dir, &name]);
        if is_dir {
            files.extend(walk_dir_reporting(&full, on_read_error));
        } else if has_scannable_extension(&name) {
            files.push(full);
        }
    }
    files
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedFlutterProject {
    pub pubspec_path: String,
    pub project_type: &'static str,
    pub source_only: bool,
    pub optional_server: bool,
}

/// Detect a Flutter project without inventing a dev-server port.
///
/// Flutter Web commonly receives an ephemeral port from `flutter run`, so the
/// web-framework detector's fixed-port contract is intentionally not reused.
pub fn detect_flutter_project(dir: &str) -> Option<DetectedFlutterProject> {
    let pubspec_path = crate::jsp::join(&[dir, "pubspec.yaml"]);
    let pubspec = std::fs::read_to_string(&pubspec_path).ok()?;
    let looks_flutter = pubspec.contains("sdk: flutter")
        || pubspec.contains("sdk:flutter")
        || pubspec
            .lines()
            .any(|line| impeccable_core::js::trim(line) == "flutter:");
    if !looks_flutter {
        return None;
    }

    let web_signal = [
        "web/index.html",
        "web/flutter.js",
        "web/main.dart.js",
    ]
    .iter()
    .any(|rel| std::path::Path::new(&crate::jsp::join(&[dir, rel])).exists());

    let source_signal = std::path::Path::new(&crate::jsp::join(&[dir, "lib/main.dart"])).exists();

    Some(DetectedFlutterProject {
        pubspec_path,
        project_type: if web_signal { "flutter-web" } else { "flutter-source" },
        source_only: !web_signal || source_signal,
        optional_server: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "impeccable-flutter-{name}-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn dart_is_scannable_in_directories() {
        let dir = temp_dir("walker");
        std::fs::create_dir_all(dir.join("lib")).unwrap();
        std::fs::create_dir_all(dir.join("node_modules/pkg")).unwrap();
        std::fs::write(dir.join("lib/main.dart"), "void main() {}\n").unwrap();
        std::fs::write(dir.join("index.html"), "<main></main>\n").unwrap();
        std::fs::write(dir.join("node_modules/pkg/ignored.dart"), "bad\n").unwrap();

        let files = walk_dir(dir.to_str().unwrap());
        assert!(files.iter().any(|f| f.ends_with("main.dart")), "{files:?}");
        assert!(files.iter().any(|f| f.ends_with("index.html")), "{files:?}");
        assert!(!files.iter().any(|f| f.contains("node_modules")), "{files:?}");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn flutter_project_metadata_does_not_invent_a_port() {
        let dir = temp_dir("project");
        std::fs::create_dir_all(dir.join("lib")).unwrap();
        std::fs::create_dir_all(dir.join("web")).unwrap();
        std::fs::write(
            dir.join("pubspec.yaml"),
            "name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n",
        )
        .unwrap();
        std::fs::write(dir.join("lib/main.dart"), "void main() {}\n").unwrap();
        std::fs::write(dir.join("web/index.html"), "<html></html>\n").unwrap();

        let detected = detect_flutter_project(dir.to_str().unwrap()).unwrap();
        assert_eq!(detected.project_type, "flutter-web");
        assert!(detected.optional_server);

        let _ = std::fs::remove_dir_all(dir);
    }
}

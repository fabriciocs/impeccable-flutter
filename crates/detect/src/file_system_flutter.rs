//! Compatibility wrapper around the upstream filesystem detector.
//!
//! The upstream implementation remains the source of truth for web framework
//! behavior. This layer widens directory discovery to Dart and uses the shared
//! Dart/Flutter project classifier so context and detect cannot diverge.

#[path = "file_system.rs"]
mod upstream;

pub use upstream::{
    build_import_graph, build_import_graph_reporting, is_html_path, is_port_listening,
    resolve_import, DetectedFramework, Fingerprint, FrameworkConfig, PortProbe,
    FRAMEWORK_CONFIGS, HIDDEN_SOURCE_DIRS, HTML_EXTENSIONS, SKIP_DIRS,
};

use impeccable_common::flutter::{
    find_nearest_dart_project, DartProjectInfo, DartProjectKind,
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
    SCANNABLE_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

pub fn walk_dir(dir: &str) -> Vec<String> {
    walk_dir_reporting(dir, &mut |_, _| {})
}

/// Upstream walker semantics with `.dart` included. Generated/hidden Flutter
/// directories such as `.dart_tool` remain excluded by the upstream skip and
/// hidden-directory rules, and `build/` is never treated as Dart source.
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
        if SKIP_DIRS.contains(&name.as_str()) || name == ".dart_tool" || name == "build" {
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
    pub root: String,
    pub pubspec_path: String,
    pub project_type: &'static str,
    pub is_dart: bool,
    pub is_flutter: bool,
    pub has_web_target: bool,
    pub has_dart_source: bool,
    pub entry_points: Vec<String>,
    /// Source scanning is always available when Dart source exists. A browser
    /// server is a separate, optional rendered-Web evidence channel.
    pub source_only: bool,
    pub optional_server: bool,
}

fn project_type(info: &DartProjectInfo) -> &'static str {
    match info.kind {
        Some(DartProjectKind::App) => "flutter-app",
        Some(DartProjectKind::Package) => "flutter-package",
        Some(DartProjectKind::Plugin) => "flutter-plugin",
        None => "dart-package",
    }
}

/// Detect the nearest Flutter project without inventing a dev-server port.
///
/// Flutter Web commonly receives an ephemeral port from `flutter run`, so the
/// web-framework detector's fixed-port contract is intentionally not reused.
pub fn detect_flutter_project(dir: &str) -> Option<DetectedFlutterProject> {
    let info = find_nearest_dart_project(std::path::Path::new(dir))?;
    if !info.is_flutter {
        return None;
    }
    Some(DetectedFlutterProject {
        root: info.root.to_string_lossy().into_owned(),
        pubspec_path: info.pubspec_path.to_string_lossy().into_owned(),
        project_type: project_type(&info),
        is_dart: info.is_dart,
        is_flutter: info.is_flutter,
        has_web_target: info.has_web_target,
        has_dart_source: info.has_dart_source,
        entry_points: info
            .entry_points
            .iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect(),
        source_only: !info.has_web_target,
        optional_server: info.has_web_target,
    })
}

/// Preserve upstream web framework detection for web projects, but never map
/// Flutter onto a fixed-port browser framework. The CLI still scans `.dart`
/// source through this wrapper's walker.
pub fn detect_framework_config(dir: &str) -> Option<FrameworkConfig> {
    if detect_flutter_project(dir).is_some() {
        None
    } else {
        upstream::detect_framework_config(dir)
    }
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
        std::fs::create_dir_all(dir.join(".dart_tool/generated")).unwrap();
        std::fs::create_dir_all(dir.join("build/generated")).unwrap();
        std::fs::write(dir.join("lib/main.dart"), "void main() {}\n").unwrap();
        std::fs::write(dir.join("index.html"), "<main></main>\n").unwrap();
        std::fs::write(dir.join("node_modules/pkg/ignored.dart"), "bad\n").unwrap();
        std::fs::write(dir.join(".dart_tool/generated/ignored.dart"), "bad\n").unwrap();
        std::fs::write(dir.join("build/generated/ignored.dart"), "bad\n").unwrap();

        let files = walk_dir(dir.to_str().unwrap());
        assert!(files.iter().any(|f| f.ends_with("main.dart")), "{files:?}");
        assert!(files.iter().any(|f| f.ends_with("index.html")), "{files:?}");
        assert!(!files.iter().any(|f| f.contains("node_modules")), "{files:?}");
        assert!(!files.iter().any(|f| f.contains(".dart_tool")), "{files:?}");
        assert!(!files.iter().any(|f| f.contains("build")), "{files:?}");

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
        assert_eq!(detected.project_type, "flutter-app");
        assert!(detected.has_web_target);
        assert!(detected.has_dart_source);
        assert!(detected.optional_server);
        assert!(detect_framework_config(dir.to_str().unwrap()).is_none());

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn dart_only_pubspec_is_not_flutter() {
        let dir = temp_dir("dart-only");
        std::fs::write(dir.join("pubspec.yaml"), "name: dart_only\n").unwrap();
        std::fs::create_dir_all(dir.join("lib")).unwrap();
        std::fs::write(dir.join("lib/main.dart"), "void main() {}\n").unwrap();
        assert!(detect_flutter_project(dir.to_str().unwrap()).is_none());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn incidental_flutter_mapping_is_not_a_flutter_project() {
        let dir = temp_dir("incidental");
        std::fs::write(
            dir.join("pubspec.yaml"),
            "name: demo\nflutter:\n  assets:\n    - images/flutter:logo.png\n",
        )
        .unwrap();
        assert!(detect_flutter_project(dir.to_str().unwrap()).is_none());
        let _ = std::fs::remove_dir_all(dir);
    }
}

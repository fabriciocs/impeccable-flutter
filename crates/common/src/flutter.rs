//! Shared Dart/Flutter project discovery used by context and detect.
//!
//! This module deliberately parses only the small, structural subset of
//! `pubspec.yaml` required for project identification. It does not treat an
//! incidental `flutter:` key as proof that the Flutter SDK is in use.

use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DartProjectKind {
    App,
    Package,
    Plugin,
}

impl DartProjectKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::App => "app",
            Self::Package => "package",
            Self::Plugin => "plugin",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DartProjectInfo {
    pub root: PathBuf,
    pub pubspec_path: PathBuf,
    pub is_dart: bool,
    pub is_flutter: bool,
    pub kind: Option<DartProjectKind>,
    pub has_web_target: bool,
    pub has_dart_source: bool,
    pub entry_points: Vec<PathBuf>,
    pub is_workspace: bool,
    pub uses_melos: bool,
}

#[derive(Debug, Default)]
struct PubspecSignals {
    flutter_sdk: bool,
    flutter_plugin: bool,
    workspace: bool,
}

/// Inspect exactly one Dart package root. A `pubspec.yaml` is required.
pub fn inspect_dart_project(root: impl AsRef<Path>) -> Option<DartProjectInfo> {
    let root = root.as_ref();
    let pubspec_path = root.join("pubspec.yaml");
    let body = fs::read_to_string(&pubspec_path).ok()?;
    let signals = parse_pubspec_signals(&body);
    let uses_melos = root.join("melos.yaml").is_file();
    let entry_points = collect_entry_points(root);
    let has_dart_source = contains_dart(&root.join("lib"), 5)
        || contains_dart(&root.join("bin"), 3)
        || !entry_points.is_empty();
    let has_web_target = root.join("web").is_dir();

    let kind = if signals.flutter_sdk {
        if signals.flutter_plugin {
            Some(DartProjectKind::Plugin)
        } else if root.join("lib/main.dart").is_file()
            || ["android", "ios", "web", "windows", "macos", "linux"]
                .iter()
                .any(|name| root.join(name).is_dir())
        {
            Some(DartProjectKind::App)
        } else {
            Some(DartProjectKind::Package)
        }
    } else {
        None
    };

    Some(DartProjectInfo {
        root: root.to_path_buf(),
        pubspec_path,
        is_dart: true,
        is_flutter: signals.flutter_sdk,
        kind,
        has_web_target,
        has_dart_source,
        entry_points,
        is_workspace: signals.workspace || uses_melos,
        uses_melos,
    })
}

/// Find the nearest package containing `start`. Files resolve from their
/// parent directory; nonexistent file-shaped paths do the same.
pub fn find_nearest_dart_project(start: impl AsRef<Path>) -> Option<DartProjectInfo> {
    let start = start.as_ref();
    let mut dir = if start.is_file() || (!start.exists() && start.extension().is_some()) {
        start.parent().unwrap_or(start).to_path_buf()
    } else {
        start.to_path_buf()
    };

    loop {
        if let Some(info) = inspect_dart_project(&dir) {
            return Some(info);
        }
        if !dir.pop() {
            return None;
        }
    }
}

/// Find the nearest Dart workspace root above `start`.
///
/// Melos and the native Dart `workspace:` declaration are both accepted. A
/// child `resolution: workspace` marker alone is not enough; discovery keeps
/// walking until it finds the declaring workspace.
pub fn find_dart_workspace_root(start: impl AsRef<Path>) -> Option<PathBuf> {
    let start = start.as_ref();
    let mut dir = if start.is_file() {
        start.parent().unwrap_or(start).to_path_buf()
    } else {
        start.to_path_buf()
    };

    loop {
        if dir.join("melos.yaml").is_file() {
            return Some(dir);
        }
        let pubspec = dir.join("pubspec.yaml");
        if let Ok(body) = fs::read_to_string(&pubspec) {
            if parse_pubspec_signals(&body).workspace {
                return Some(dir);
            }
        }
        if !dir.pop() {
            return None;
        }
    }
}

pub fn technology_name(info: &DartProjectInfo) -> &'static str {
    if info.is_flutter {
        "flutter"
    } else {
        "dart"
    }
}

fn parse_pubspec_signals(body: &str) -> PubspecSignals {
    let mut signals = PubspecSignals::default();
    let mut stack: Vec<(usize, String)> = Vec::new();

    for raw in body.lines() {
        let uncommented = strip_yaml_comment(raw);
        if uncommented.trim().is_empty() {
            continue;
        }
        let indent = uncommented.chars().take_while(|c| *c == ' ').count();
        let trimmed = uncommented.trim();
        if trimmed.starts_with('-') {
            continue;
        }
        let Some((raw_key, raw_value)) = split_yaml_mapping(trimmed) else {
            continue;
        };
        let key = unquote(raw_key.trim());
        let value = unquote(raw_value.trim());

        while stack.last().is_some_and(|(parent_indent, _)| *parent_indent >= indent) {
            stack.pop();
        }

        let mut path: Vec<&str> = stack.iter().map(|(_, key)| key.as_str()).collect();
        path.push(key.as_str());

        if indent == 0 && key == "workspace" {
            signals.workspace = true;
        }
        if path.len() == 3
            && matches!(path[0], "dependencies" | "dev_dependencies")
            && path[1] == "flutter"
            && path[2] == "sdk"
            && value == "flutter"
        {
            signals.flutter_sdk = true;
        }
        if path.len() == 2 && path[0] == "flutter" && path[1] == "plugin" {
            signals.flutter_plugin = true;
        }

        if value.is_empty() {
            stack.push((indent, key));
        }
    }

    signals
}

fn split_yaml_mapping(line: &str) -> Option<(&str, &str)> {
    let mut quote: Option<char> = None;
    for (index, ch) in line.char_indices() {
        match ch {
            '\'' | '"' => {
                if quote == Some(ch) {
                    quote = None;
                } else if quote.is_none() {
                    quote = Some(ch);
                }
            }
            ':' if quote.is_none() => return Some((&line[..index], &line[index + 1..])),
            _ => {}
        }
    }
    None
}

fn strip_yaml_comment(line: &str) -> String {
    let mut quote: Option<char> = None;
    for (index, ch) in line.char_indices() {
        match ch {
            '\'' | '"' => {
                if quote == Some(ch) {
                    quote = None;
                } else if quote.is_none() {
                    quote = Some(ch);
                }
            }
            '#' if quote.is_none() => return line[..index].to_string(),
            _ => {}
        }
    }
    line.to_string()
}

fn unquote(value: &str) -> String {
    let value = value.trim();
    if value.len() >= 2 {
        let first = value.as_bytes()[0];
        let last = value.as_bytes()[value.len() - 1];
        if (first == b'\'' && last == b'\'') || (first == b'"' && last == b'"') {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

fn contains_dart(dir: &Path, depth: usize) -> bool {
    if depth == 0 || !dir.is_dir() {
        return false;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|v| v.to_str()) == Some("dart") {
            return true;
        }
        if path.is_dir() && !is_generated_or_hidden(&path) && contains_dart(&path, depth - 1) {
            return true;
        }
    }
    false
}

fn collect_entry_points(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    collect_named_entry_points(&root.join("lib"), 4, &mut out);
    collect_bin_entry_points(&root.join("bin"), 2, &mut out);
    collect_example_entry_points(&root.join("example"), 4, &mut out);
    out.sort();
    out.dedup();
    out.truncate(32);
    out
}

fn collect_named_entry_points(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth == 0 || !dir.is_dir() || out.len() >= 32 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("");
            if name == "main.dart" || (name.ends_with(".dart") && (name.starts_with("main_") || name.ends_with("_main.dart"))) {
                out.push(path);
            }
        } else if path.is_dir() && !is_generated_or_hidden(&path) {
            collect_named_entry_points(&path, depth - 1, out);
        }
    }
}

fn collect_bin_entry_points(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth == 0 || !dir.is_dir() || out.len() >= 32 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|v| v.to_str()) == Some("dart") {
            out.push(path);
        } else if path.is_dir() && !is_generated_or_hidden(&path) {
            collect_bin_entry_points(&path, depth - 1, out);
        }
    }
}

fn collect_example_entry_points(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth == 0 || !dir.is_dir() || out.len() >= 32 {
        return;
    }
    let candidate = dir.join("lib/main.dart");
    if candidate.is_file() {
        out.push(candidate);
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && !is_generated_or_hidden(&path) {
            collect_example_entry_points(&path, depth - 1, out);
        }
    }
}

fn is_generated_or_hidden(path: &Path) -> bool {
    matches!(
        path.file_name().and_then(|v| v.to_str()),
        Some("build" | ".dart_tool" | ".git")
    ) || path
        .file_name()
        .and_then(|v| v.to_str())
        .is_some_and(|name| name.starts_with('.'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("impeccable-common-flutter-{name}-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn write(path: &Path, relative: &str, content: &str) {
        let file = path.join(relative);
        if let Some(parent) = file.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(file, content).unwrap();
    }

    #[test]
    fn dart_only_is_not_flutter() {
        let root = temp("dart");
        write(&root, "pubspec.yaml", "name: dart_only\n");
        write(&root, "lib/main.dart", "void main() {}\n");
        let info = inspect_dart_project(&root).unwrap();
        assert!(info.is_dart);
        assert!(!info.is_flutter);
        assert_eq!(info.kind, None);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn flutter_app_requires_sdk_dependency() {
        let root = temp("app");
        write(&root, "pubspec.yaml", "name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n");
        write(&root, "lib/main.dart", "void main() {}\n");
        let info = inspect_dart_project(&root).unwrap();
        assert!(info.is_flutter);
        assert_eq!(info.kind, Some(DartProjectKind::App));
        assert!(info.has_dart_source);
        assert_eq!(info.entry_points.len(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn incidental_flutter_key_is_not_flutter_sdk() {
        let root = temp("incidental");
        write(&root, "pubspec.yaml", "name: demo\nflutter:\n  assets:\n    - flutter:logo.png\n");
        let info = inspect_dart_project(&root).unwrap();
        assert!(!info.is_flutter);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn plugin_package_and_web_are_distinguished() {
        let plugin = temp("plugin");
        write(&plugin, "pubspec.yaml", "name: plug\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  plugin:\n    platforms:\n      android:\n        package: demo\n");
        write(&plugin, "lib/plugin.dart", "class Plugin {}\n");
        assert_eq!(inspect_dart_project(&plugin).unwrap().kind, Some(DartProjectKind::Plugin));

        let package = temp("package");
        write(&package, "pubspec.yaml", "name: pkg\ndependencies:\n  flutter:\n    sdk: flutter\n");
        write(&package, "lib/pkg.dart", "class Pkg {}\n");
        assert_eq!(inspect_dart_project(&package).unwrap().kind, Some(DartProjectKind::Package));

        let web = temp("web");
        write(&web, "pubspec.yaml", "name: webapp\ndependencies:\n  flutter:\n    sdk: flutter\n");
        write(&web, "lib/main.dart", "void main() {}\n");
        write(&web, "web/index.html", "<html></html>\n");
        let web_info = inspect_dart_project(&web).unwrap();
        assert_eq!(web_info.kind, Some(DartProjectKind::App));
        assert!(web_info.has_web_target);

        let _ = fs::remove_dir_all(plugin);
        let _ = fs::remove_dir_all(package);
        let _ = fs::remove_dir_all(web);
    }

    #[test]
    fn comments_and_quotes_do_not_break_sdk_detection() {
        let root = temp("comments");
        write(&root, "pubspec.yaml", "name: demo # comment\ndependencies:\n  'flutter':\n    sdk: 'flutter' # sdk\n");
        assert!(inspect_dart_project(&root).unwrap().is_flutter);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn finds_alternate_entry_points() {
        let root = temp("entries");
        write(&root, "pubspec.yaml", "name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n");
        write(&root, "lib/main_dev.dart", "void main() {}\n");
        write(&root, "bin/tool.dart", "void main() {}\n");
        let info = inspect_dart_project(&root).unwrap();
        assert_eq!(info.entry_points.len(), 2);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn recognizes_melos_and_native_dart_workspace() {
        let melos = temp("melos");
        write(&melos, "pubspec.yaml", "name: workspace\n");
        write(&melos, "melos.yaml", "name: workspace\n");
        let info = inspect_dart_project(&melos).unwrap();
        assert!(info.is_workspace);
        assert!(info.uses_melos);

        let native = temp("workspace");
        write(&native, "pubspec.yaml", "name: workspace\nworkspace:\n  - packages/app\n");
        assert!(inspect_dart_project(&native).unwrap().is_workspace);

        let _ = fs::remove_dir_all(melos);
        let _ = fs::remove_dir_all(native);
    }

    #[test]
    fn nearest_project_and_workspace_walk_up() {
        let workspace = temp("walk");
        write(&workspace, "pubspec.yaml", "name: root\nworkspace:\n  - packages/app\n");
        let app = workspace.join("packages/app");
        write(&workspace, "packages/app/pubspec.yaml", "name: app\ndependencies:\n  flutter:\n    sdk: flutter\n");
        write(&workspace, "packages/app/lib/main.dart", "void main() {}\n");

        let info = find_nearest_dart_project(app.join("lib/main.dart")).unwrap();
        assert_eq!(info.root, app);
        assert_eq!(find_dart_workspace_root(&info.root).unwrap(), workspace);
        let _ = fs::remove_dir_all(workspace);
    }
}

//! Flutter-aware compatibility layer around the upstream context resolver.
//!
//! The upstream resolver remains intact in `context_upstream.rs`. This layer
//! only adds Dart/Flutter package and workspace discovery and treats existing
//! Flutter source as incumbent visual implementation.

#[path = "context_upstream.rs"]
mod upstream;

pub use upstream::*;

use crate::target_args::{has_target_option, TargetOptions};
use crate::util::Env;
use impeccable_common::flutter::{
    find_dart_workspace_root, find_nearest_dart_project, inspect_dart_project,
};
use std::path::{Path, PathBuf};

fn target_probe(cwd: &str, options: &TargetOptions) -> PathBuf {
    let Some(target) = options.target_path.as_deref().filter(|value| !value.trim().is_empty()) else {
        return PathBuf::from(cwd);
    };
    let path = PathBuf::from(target);
    let path = if path.is_absolute() { path } else { PathBuf::from(cwd).join(path) };
    if path.is_file() || (!path.exists() && path.extension().is_some()) {
        path.parent().unwrap_or(&path).to_path_buf()
    } else {
        path
    }
}

fn enhance_project(mut project: Project, cwd: &str, options: &TargetOptions) -> Project {
    let probe = target_probe(cwd, options);
    let Some(info) = find_nearest_dart_project(&probe) else {
        return project;
    };

    project.project_root = info.root.to_string_lossy().into_owned();
    if let Some(workspace_root) = find_dart_workspace_root(&info.root) {
        project.repo_root = workspace_root.to_string_lossy().into_owned();
        project.is_monorepo = workspace_root != info.root
            || inspect_dart_project(&workspace_root)
                .is_some_and(|workspace| workspace.is_workspace);
    }
    project
}

/// Resolve Flutter/Dart package roots before falling back to the upstream
/// Node/web workspace heuristics.
pub fn resolve_project(cwd: &str, options: &TargetOptions, env: &Env) -> Project {
    enhance_project(upstream::resolve_project(cwd, options, env), cwd, options)
}

pub fn resolve_project_root(cwd: &str, options: &TargetOptions, env: &Env) -> String {
    resolve_project(cwd, options, env).project_root
}

pub fn resolve_context(cwd: &str, options: &TargetOptions, env: &Env) -> Resolved {
    let mut resolved = upstream::resolve_context(cwd, options, env);
    let old_project_root = resolved.project_root.clone();
    let project = resolve_project(cwd, options, env);
    if resolved.context_dir == old_project_root
        && resolved.product_path.is_none()
        && resolved.design_path.is_none()
    {
        resolved.context_dir = project.project_root.clone();
    }
    resolved.project_root = project.project_root;
    resolved.repo_root = project.repo_root;
    resolved.is_monorepo = project.is_monorepo;
    resolved.target_dir = project.target_dir;
    resolved
}

pub fn resolve_context_dir(cwd: &str, options: &TargetOptions, env: &Env) -> String {
    resolve_context(cwd, options, env).context_dir
}

pub fn load_context(cwd: &str, options: &TargetOptions, env: &Env) -> Ctx {
    let mut ctx = upstream::load_context(cwd, options, env);
    let old_project_root = ctx.project_root.clone();
    let project = resolve_project(cwd, options, env);
    if ctx.context_dir == old_project_root && !ctx.has_product && !ctx.has_design {
        ctx.context_dir = project.project_root.clone();
    }
    ctx.project_root = project.project_root;
    ctx.repo_root = project.repo_root;
    ctx.is_monorepo = project.is_monorepo;
    ctx.has_visual_implementation = ctx.has_visual_implementation
        || inspect_dart_project(&ctx.project_root)
            .is_some_and(|info| info.is_flutter && info.has_dart_source);
    ctx
}

/// Visual implementation means either the upstream web evidence or real
/// Flutter source. Dart-only packages are intentionally not promoted to a UI.
pub fn has_visual_implementation(project_root: &str) -> bool {
    upstream::has_visual_implementation(project_root)
        || inspect_dart_project(project_root)
            .is_some_and(|info| info.is_flutter && info.has_dart_source)
}

fn should_skip_workspace_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            name.starts_with('.')
                || matches!(
                    name,
                    "node_modules" | "build" | ".dart_tool" | "dist" | "coverage" | "vendor" | "vendors"
                )
        })
}

fn collect_dart_candidates(root: &Path, dir: &Path, depth: usize, out: &mut Vec<TargetCandidate>) {
    if depth == 0 || out.len() >= 100 || !dir.is_dir() {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() || should_skip_workspace_dir(&path) {
            continue;
        }
        if let Some(info) = inspect_dart_project(&path) {
            let relative = crate::jsp::to_posix(&crate::jsp::relative(
                "/",
                &root.to_string_lossy(),
                &path.to_string_lossy(),
            ));
            let target_example = info
                .entry_points
                .first()
                .map(|entry| {
                    crate::jsp::to_posix(&crate::jsp::relative(
                        "/",
                        &root.to_string_lossy(),
                        &entry.to_string_lossy(),
                    ))
                })
                .unwrap_or_else(|| relative.clone());
            out.push(TargetCandidate {
                name: path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("dart-project")
                    .to_string(),
                path: relative,
                target_example,
                product_status: "missing",
                product_path: None,
                design_status: "missing",
                design_path: None,
            });
            continue;
        }
        collect_dart_candidates(root, &path, depth - 1, out);
    }
}

fn dart_workspace_candidates(repo_root: &str) -> Vec<TargetCandidate> {
    let root = PathBuf::from(repo_root);
    let mut candidates = Vec::new();
    collect_dart_candidates(&root, &root, 5, &mut candidates);
    candidates.sort_by(|a, b| a.path.cmp(&b.path));
    candidates
}

pub fn resolve_target_selection(
    cwd: &str,
    options: &TargetOptions,
    env: &Env,
) -> Option<TargetSelection> {
    if has_target_option(options) {
        return None;
    }
    if let Some(selection) = upstream::resolve_target_selection(cwd, options, env) {
        return Some(selection);
    }
    let project = resolve_project(cwd, &TargetOptions::default(), env);
    if !project.is_monorepo
        || crate::jsp::resolve(&project.project_root, &[])
            != crate::jsp::resolve(&project.repo_root, &[])
    {
        return None;
    }
    let target_candidates = dart_workspace_candidates(&project.repo_root);
    if target_candidates.is_empty() {
        return None;
    }
    Some(TargetSelection {
        project_root: project.project_root,
        repo_root: project.repo_root,
        target_candidates,
    })
}

pub fn resolve_target_path(cwd: &str, target_path: &str, env: &Env) -> String {
    let upstream_path = upstream::resolve_target_path(cwd, target_path, env);
    if Path::new(&upstream_path).exists() {
        return upstream_path;
    }
    if target_path.contains('/') || target_path.contains('\\') {
        return upstream_path;
    }
    let workspace_root = find_dart_workspace_root(cwd).unwrap_or_else(|| PathBuf::from(cwd));
    let matches: Vec<TargetCandidate> = dart_workspace_candidates(&workspace_root.to_string_lossy())
        .into_iter()
        .filter(|candidate| candidate.name == target_path)
        .collect();
    if matches.len() == 1 {
        return workspace_root
            .join(&matches[0].path)
            .to_string_lossy()
            .into_owned();
    }
    upstream_path
}

#[cfg(test)]
mod flutter_context_tests {
    use super::*;
    use std::collections::HashMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "impeccable-context-flutter-{name}-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn write(root: &Path, rel: &str, body: &str) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, body).unwrap();
    }

    fn env() -> Env {
        HashMap::new()
    }

    #[test]
    fn flutter_target_resolves_to_package_root_and_visual_source() {
        let root = temp("app");
        write(
            &root,
            "pubspec.yaml",
            "name: app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        );
        write(&root, "lib/main.dart", "void main() {}\n");
        let options = TargetOptions {
            target_path: Some(root.join("lib/main.dart").to_string_lossy().into_owned()),
            ..Default::default()
        };
        let ctx = load_context(&root.to_string_lossy(), &options, &env());
        assert_eq!(PathBuf::from(&ctx.project_root), root);
        assert!(ctx.has_visual_implementation);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn melos_child_resolves_package_and_workspace_separately() {
        let root = temp("melos");
        write(&root, "pubspec.yaml", "name: workspace\n");
        write(&root, "melos.yaml", "name: workspace\n");
        write(
            &root,
            "apps/demo/pubspec.yaml",
            "name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n",
        );
        write(&root, "apps/demo/lib/main.dart", "void main() {}\n");
        let options = TargetOptions {
            target_path: Some(root.join("apps/demo/lib").to_string_lossy().into_owned()),
            ..Default::default()
        };
        let project = resolve_project(&root.to_string_lossy(), &options, &env());
        assert_eq!(PathBuf::from(project.project_root), root.join("apps/demo"));
        assert_eq!(PathBuf::from(project.repo_root), root);
        assert!(project.is_monorepo);
        let _ = std::fs::remove_dir_all(root);
    }
}

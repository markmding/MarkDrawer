// MARK#EZVE.COM
use crate::error::{AppError, AppResult};
use ignore::{Walk, WalkBuilder};
use std::fs;
use std::path::{Component, Path, PathBuf};

/// Directories that never show up in the tree or the search index.
pub const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    ".obsidian",
    ".trash",
    ".markup",
    ".mark-drawer-trash",
    // Trash folder used before the Mark Drawer rename; still hidden so old
    // drawers look clean.
    ".markup-trash",
];

/// Forward-slashed path without Windows' verbatim prefix.
///
/// `canonicalize()` returns `\\?\C:\...` (and `\\?\UNC\server\share` for
/// network paths), which is correct for IO but ugly in the UI and awkward to
/// compare against paths supplied by Explorer.
pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy().replace('\\', "/");
    if let Some(rest) = text.strip_prefix("//?/UNC/") {
        return format!("//{rest}");
    }
    if let Some(rest) = text.strip_prefix("//?/unc/") {
        return format!("//{rest}");
    }
    text.strip_prefix("//?/").unwrap_or(&text).to_string()
}

/// Lexically normalizes a path (no filesystem access, so it also works for
/// paths that do not exist yet). Resolves `.` and `..` components.
pub fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Joins a drawer-relative path and guarantees the result stays inside the
/// drawer — the core of the F1 security rule.
pub fn resolve_in_drawer(drawer: &Path, rel: &str) -> AppResult<PathBuf> {
    let rel = rel.trim();
    if rel.is_empty() {
        return Err(AppError::Message("路径不能为空".into()));
    }
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err(AppError::OutsideDrawer(rel.to_string()));
    }
    let drawer_norm = normalize(drawer);
    let target = normalize(&drawer_norm.join(rel_path));
    if !target.starts_with(&drawer_norm) {
        return Err(AppError::OutsideDrawer(rel.to_string()));
    }
    Ok(target)
}

/// Drawer traversal that honors `.gitignore`, `.ignore`, `.drawerignore` and
/// the legacy `.markupignore` name.
///
/// - `require_git(false)`: apply `.gitignore` even when the folder is not a repo
/// - `parents(false)`: never read ignore files outside the drawer
/// - `git_global(false)`: ignore the user's global git excludes
/// - hidden files are skipped; hard-coded build folders are pruned as well
pub fn drawer_walker(root: &Path) -> Walk {
    let mut builder = WalkBuilder::new(root);
    builder
        .hidden(true)
        .parents(false)
        .ignore(true)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(true)
        .require_git(false);
    builder.add_custom_ignore_filename(".drawerignore");
    builder.add_custom_ignore_filename(".markupignore");
    builder.filter_entry(|entry| {
        if entry.depth() == 0 {
            return true;
        }
        let name = entry.file_name().to_string_lossy();
        !SKIP_DIRS.contains(&name.as_ref())
    });
    builder.build()
}

/// Folders owned by the application, not by the drawer. They live next to the
/// executable so opening a note never scatters app folders into the user's
/// document folders.
pub const APP_DIRS: &[&str] = &["attachments", "themes", "templates"];

/// Directory containing the running executable (falls back to the CWD when the
/// executable path is unavailable, which only happens in exotic embedders).
pub fn app_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Theme files embedded at build time and seeded next to the executable on
/// first run. Existing files are never overwritten, so edits and deletions
/// made by the user are respected.
const BUILTIN_THEMES: &[(&str, &str)] = &[
    ("Catppuccin.css", include_str!("../themes/Catppuccin.css")),
    ("GitHub.css", include_str!("../themes/GitHub.css")),
    ("Material.css", include_str!("../themes/Material.css")),
    ("Monokai-Pro.css", include_str!("../themes/Monokai-Pro.css")),
    ("Nord.css", include_str!("../themes/Nord.css")),
];

fn seed_builtin_themes(root: &Path) -> AppResult<()> {
    let dir = root.join("themes");
    for (name, css) in BUILTIN_THEMES {
        let path = dir.join(name);
        if path.exists() {
            continue;
        }
        fs::write(&path, css)?;
    }
    Ok(())
}

/// Ready-to-use note templates embedded at build time and seeded the same way
/// as the themes: first run only, never overwriting edits.
const BUILTIN_TEMPLATES: &[(&str, &str)] = &[
    ("笔记.md", include_str!("../templates/笔记.md")),
    ("每日笔记.md", include_str!("../templates/每日笔记.md")),
    ("任务清单.md", include_str!("../templates/任务清单.md")),
    ("会议记录.md", include_str!("../templates/会议记录.md")),
    ("项目笔记.md", include_str!("../templates/项目笔记.md")),
    ("读书笔记.md", include_str!("../templates/读书笔记.md")),
];

fn seed_builtin_templates(root: &Path) -> AppResult<()> {
    let dir = root.join("templates");
    for (name, markdown) in BUILTIN_TEMPLATES {
        let path = dir.join(name);
        if path.exists() {
            continue;
        }
        fs::write(&path, markdown)?;
    }
    Ok(())
}

pub fn ensure_app_dirs() -> AppResult<PathBuf> {
    let root = app_dir();
    for dir in APP_DIRS {
        fs::create_dir_all(root.join(dir))?;
    }
    seed_builtin_themes(&root)?;
    seed_builtin_templates(&root)?;
    Ok(root)
}

/// True when a relative export path contains no absolute prefix or `..`.
pub fn is_safe_relative(rel: &str) -> bool {
    let path = Path::new(rel);
    !path.is_absolute()
        && path
            .components()
            .all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_verbatim_prefix_from_display_paths() {
        // Verbatim prefix is two backslashes, i.e. `\\?\D:\...` on the wire.
        let drive = format!("{}{}", r"\\", r"?\D:\notes\drawer");
        let unc = format!("{}{}", r"\\", r"?\UNC\server\share\drawer");
        assert_eq!(display_path(Path::new(&drive)), "D:/notes/drawer");
        assert_eq!(display_path(Path::new(&unc)), "//server/share/drawer");
        assert_eq!(display_path(Path::new(r"D:\notes")), "D:/notes");
    }

    #[test]
    fn safe_relative_rejects_traversal_and_absolute_paths() {
        assert!(is_safe_relative("notes/a.md"));
        assert!(!is_safe_relative("../a.md"));
        assert!(!is_safe_relative(r"D:\a.md"));
    }

    #[test]
    fn seeds_builtin_themes_without_overwriting_user_edits() {
        let root = std::env::temp_dir().join(format!("markdrawer-theme-seed-{}", std::process::id()));
        fs::create_dir_all(root.join("themes")).unwrap();

        seed_builtin_themes(&root).unwrap();
        let files: Vec<String> = fs::read_dir(root.join("themes"))
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(files.len(), BUILTIN_THEMES.len());
        assert!(files.iter().any(|name| name == "Nord.css"));

        fs::write(root.join("themes/Nord.css"), "/* 用户修改 */").unwrap();
        seed_builtin_themes(&root).unwrap();
        let content = fs::read_to_string(root.join("themes/Nord.css")).unwrap();
        assert_eq!(content, "/* 用户修改 */");

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn seeds_builtin_templates_without_overwriting_user_edits() {
        let root = std::env::temp_dir().join(format!("markdrawer-template-seed-{}", std::process::id()));
        fs::create_dir_all(root.join("templates")).unwrap();

        seed_builtin_templates(&root).unwrap();
        let files: Vec<String> = fs::read_dir(root.join("templates"))
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(files.len(), BUILTIN_TEMPLATES.len());
        assert!(files.iter().any(|name| name == "会议记录.md"));
        let meeting = fs::read_to_string(root.join("templates/会议记录.md")).unwrap();
        assert!(meeting.contains("## 行动项"));

        fs::write(root.join("templates/笔记.md"), "# 我的模板\n").unwrap();
        seed_builtin_templates(&root).unwrap();
        let content = fs::read_to_string(root.join("templates/笔记.md")).unwrap();
        assert_eq!(content, "# 我的模板\n");

        fs::remove_dir_all(&root).ok();
    }
}
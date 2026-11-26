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
///
/// File names are ASCII on purpose: the template name becomes the note name in
/// a `新文档` dropdown, and a Chinese name turns into mojibake in the file
/// pickers and archives of some systems.
const BUILTIN_TEMPLATES: &[(&str, &str)] = &[
    ("note.md", include_str!("../templates/note.md")),
    ("daily.md", include_str!("../templates/daily.md")),
    ("todo.md", include_str!("../templates/todo.md")),
    ("meeting.md", include_str!("../templates/meeting.md")),
    ("project.md", include_str!("../templates/project.md")),
    ("book.md", include_str!("../templates/book.md")),
];

/// Earlier builds seeded Chinese file names. They are renamed in place rather
/// than re-seeded, so a user who edited a template keeps the edit and does not
/// end up with two copies of the same template.
const LEGACY_TEMPLATE_NAMES: &[(&str, &str)] = &[
    ("笔记.md", "note.md"),
    ("每日笔记.md", "daily.md"),
    ("任务清单.md", "todo.md"),
    ("会议记录.md", "meeting.md"),
    ("项目笔记.md", "project.md"),
    ("读书笔记.md", "book.md"),
];

/// Moves a pre-0.7 template to its ASCII name. Skipped when the new name
/// already exists, so a hand-made `note.md` is never clobbered.
fn migrate_legacy_templates(dir: &Path) -> AppResult<()> {
    for (old, new) in LEGACY_TEMPLATE_NAMES {
        let from = dir.join(old);
        let to = dir.join(new);
        if from.exists() && !to.exists() {
            fs::rename(&from, &to)?;
        }
    }
    Ok(())
}

fn seed_builtin_templates(root: &Path) -> AppResult<()> {
    let dir = root.join("templates");
    migrate_legacy_templates(&dir)?;
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
        assert!(files.iter().any(|name| name == "meeting.md"));
        let meeting = fs::read_to_string(root.join("templates/meeting.md")).unwrap();
        assert!(meeting.contains("## 行动项"));
        // Every template carries a bilingual title and the usage block.
        for (name, _) in BUILTIN_TEMPLATES {
            let body = fs::read_to_string(root.join("templates").join(name)).unwrap();
            assert!(body.starts_with("# "), "{name} needs a title");
            assert!(body.contains(" / "), "{name} needs a bilingual title");
            assert!(body.contains("怎么用 / How to use"), "{name} needs the usage block");
            assert!(body.contains("[~]"), "{name} should demo the three-state task");
        }

        fs::write(root.join("templates/note.md"), "# 我的模板\n").unwrap();
        seed_builtin_templates(&root).unwrap();
        let content = fs::read_to_string(root.join("templates/note.md")).unwrap();
        assert_eq!(content, "# 我的模板\n");

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn renames_legacy_chinese_templates_in_place() {
        let root = std::env::temp_dir().join(format!("markdrawer-template-rename-{}", std::process::id()));
        let dir = root.join("templates");
        fs::create_dir_all(&dir).unwrap();
        // A user-edited legacy template: the content must survive the rename.
        fs::write(dir.join("笔记.md"), "# 我改过的模板\n").unwrap();

        seed_builtin_templates(&root).unwrap();

        assert!(!dir.join("笔记.md").exists());
        let moved = fs::read_to_string(dir.join("note.md")).unwrap();
        assert_eq!(moved, "# 我改过的模板\n");
        let files: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(files.len(), BUILTIN_TEMPLATES.len());

        fs::remove_dir_all(&root).ok();
    }
}
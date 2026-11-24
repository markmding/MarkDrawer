// MARK#EZVE.COM
use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// Picks the document path out of a process command line.
///
/// Windows launches associated files as `Mark Drawer.exe "C:\notes\a.md"`, and a
/// manual `Mark Drawer.exe notes.md` may use a path relative to the caller's cwd.
/// The first existing file wins; flags and missing paths are ignored.
pub fn file_from_args<I, S>(args: I, cwd: Option<&Path>) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    let fallback = std::env::current_dir().ok();
    let base = cwd.or(fallback.as_deref());

    for raw in args.into_iter().skip(1) {
        let arg = raw.into();
        let text = arg.to_string_lossy();
        let text = text.trim().trim_matches('"');
        if text.is_empty() || text.starts_with('-') {
            continue;
        }
        let candidate = PathBuf::from(text);
        let path = match base {
            Some(dir) if candidate.is_relative() => dir.join(candidate),
            _ => candidate,
        };
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_file(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(name);
        fs::write(&path, "# test\n").unwrap();
        path
    }

    #[test]
    fn picks_existing_file_after_exe() {
        let file = temp_file("mark-drawer-launch-absolute.md");
        let args = vec![
            "Mark Drawer.exe".to_string(),
            file.to_string_lossy().to_string(),
        ];
        assert_eq!(file_from_args(args, None), Some(file.clone()));
        let _ = fs::remove_file(file);
    }

    #[test]
    fn resolves_relative_path_against_cwd() {
        let dir = std::env::temp_dir();
        let file = dir.join("mark-drawer-launch-relative.md");
        fs::write(&file, "# test\n").unwrap();
        let args = vec!["Mark Drawer.exe".to_string(), "mark-drawer-launch-relative.md".to_string()];
        assert_eq!(file_from_args(args, Some(&dir)), Some(file.clone()));
        let _ = fs::remove_file(file);
    }

    #[test]
    fn ignores_flags_and_missing_paths() {
        let args = vec![
            "Mark Drawer.exe".to_string(),
            "--flag".to_string(),
            "definitely-not-here.md".to_string(),
        ];
        assert_eq!(file_from_args(args, None), None);
    }

    #[test]
    fn ignores_directories_and_exe_only() {
        let dir = std::env::temp_dir();
        let args = vec!["Mark Drawer.exe".to_string(), dir.to_string_lossy().to_string()];
        assert_eq!(file_from_args(args, None), None);
        assert_eq!(file_from_args(vec!["Mark Drawer.exe".to_string()], None), None);
    }
}
// MARK#EZVE.COM
use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

/// Minimum gap between two `drawer:changed` / `files:changed` emissions.
/// Bursty activity (a `git pull`, a bulk save) collapses into one event.
const FLUSH_WINDOW: Duration = Duration::from_millis(200);

/// One changed path plus what happened to it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedPath {
    pub path: String,
    /// `modify` | `create` | `remove`
    pub kind: String,
}

fn event_kind(event: &notify::Event) -> String {
    if event.kind.is_create() {
        "create".into()
    } else if event.kind.is_remove() {
        "remove".into()
    } else {
        "modify".into()
    }
}

/// Coalesces fast notify callbacks: events within `FLUSH_WINDOW` of the last
/// emission are batched together and flushed as a single payload, so a burst of
/// filesystem notifications never produces more than one IPC round-trip per
/// window.
struct Coalescer {
    pending: Mutex<Vec<ChangedPath>>,
    timer: Mutex<Option<Instant>>,
}

impl Coalescer {
    fn new() -> Self {
        Self {
            pending: Mutex::new(Vec::new()),
            timer: Mutex::new(None),
        }
    }

    /// Pushes an event and, once the window has elapsed since the first one,
    /// flushes everything accumulated so far in a single emit.
    fn push(&self, app: &AppHandle, event: &str, change: ChangedPath) {
        let mut pending = self
            .pending
            .lock()
            .unwrap_or_else(|err| err.into_inner());
        let mut timer = self
            .timer
            .lock()
            .unwrap_or_else(|err| err.into_inner());

        pending.push(change);
        if timer.is_none() {
            *timer = Some(Instant::now());
        }
        let due = timer
            .as_ref()
            .is_some_and(|since| since.elapsed() >= FLUSH_WINDOW);
        if !due {
            return;
        }

        let batch = std::mem::take(&mut *pending);
        *timer = None;
        drop(pending);
        drop(timer);
        let _ = app.emit(event, batch);
    }
}

/// Two independent watcher slots so the recursive drawer watcher and the
/// per-file single-file watchers never kill each other. Each slot owns its own
/// coalescer so the two event streams stay independent.
#[derive(Default)]
pub struct WatcherState {
    drawer: Mutex<Option<notify::RecommendedWatcher>>,
    files: Mutex<Option<notify::RecommendedWatcher>>,
    file_targets: Mutex<Vec<PathBuf>>,
}

fn normalize_display(path: &Path) -> String {
    // Matches `paths::display_path` semantics (strip `\\?\` prefix) for the
    // case where a non-canonical path (e.g. `\\?\UNC\...`) is passed in.
    let text = path.to_string_lossy().replace('\\', "/");
    if let Some(rest) = text.strip_prefix("//?/UNC/") {
        return format!("//{rest}");
    }
    if let Some(rest) = text.strip_prefix("//?/unc/") {
        return format!("//{rest}");
    }
    text.strip_prefix("//?/").unwrap_or(&text).to_string()
}

/// Starts (or restarts) recursive watching for the given drawer.
/// Emits `drawer:changed` with a list of changed absolute paths.
#[tauri::command]
pub fn watch_drawer(
    app: AppHandle,
    state: State<'_, WatcherState>,
    root: String,
) -> Result<(), String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(format!("不是有效的文件夹：{root}"));
    }

    let mut guard = state
        .drawer
        .lock()
        .map_err(|_| "文件监听状态锁不可用".to_string())?;
    *guard = None;

    let handle = app.clone();
    let coalescer = Coalescer::new();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else { return };
        if !(event.kind.is_modify() || event.kind.is_create() || event.kind.is_remove()) {
            return;
        }
        let kind = event_kind(&event);
        for path in &event.paths {
            coalescer.push(
                &handle,
                "drawer:changed",
                ChangedPath {
                    path: normalize_display(path),
                    kind: kind.clone(),
                },
            );
        }
    })
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    // Themes live next to the executable; watch them too so saving a .css file
    // still hot-reloads without touching the drawer.
    let themes = crate::paths::app_dir().join("themes");
    if themes.is_dir() {
        let _ = watcher.watch(&themes, RecursiveMode::Recursive);
    }

    *guard = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_drawer(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut guard = state
        .drawer
        .lock()
        .map_err(|_| "文件监听状态锁不可用".to_string())?;
    *guard = None;
    Ok(())
}

/// Watches a set of individual files (each file's own folder, non-recursively).
/// Emits `files:changed` with the changed absolute paths, filtered down to only
/// the exact files we asked for so sibling activity in the same folder never
/// triggers a spurious refresh.
#[tauri::command]
pub fn watch_files(
    app: AppHandle,
    state: State<'_, WatcherState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let files: Vec<PathBuf> = paths
        .iter()
        .filter(|path| !path.contains("://"))
        .map(PathBuf::from)
        .collect();

    let mut targets_guard = state
        .file_targets
        .lock()
        .map_err(|_| "文件监听状态锁不可用".to_string())?;
    let mut guard = state
        .files
        .lock()
        .map_err(|_| "文件监听状态锁不可用".to_string())?;
    *guard = None;

    if files.is_empty() {
        *targets_guard = Vec::new();
        return Ok(());
    }

    let mut set = BTreeSet::new();
    for file in &files {
        if file.is_file() {
            if let Some(parent) = file.parent() {
                set.insert(parent.to_path_buf());
            }
        }
    }

    let targets: Vec<PathBuf> = files.clone();
    let handle = app.clone();
    let coalescer = Coalescer::new();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else { return };
        if !(event.kind.is_modify() || event.kind.is_create() || event.kind.is_remove()) {
            return;
        }
        let kind = event_kind(&event);
        for path in &event.paths {
            let parent = match path.parent() {
                Some(parent) => parent,
                None => continue,
            };
            if !targets.iter().any(|target| {
                target.parent() == Some(parent) && target.file_name() == path.file_name()
            }) {
                continue;
            }
            coalescer.push(
                &handle,
                "files:changed",
                ChangedPath {
                    path: normalize_display(path),
                    kind: kind.clone(),
                },
            );
        }
    })
    .map_err(|error| error.to_string())?;

    for dir in &set {
        let _ = watcher.watch(dir, RecursiveMode::NonRecursive);
    }

    *guard = Some(watcher);
    *targets_guard = files;
    Ok(())
}

#[tauri::command]
pub fn unwatch_files(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut guard = state
        .files
        .lock()
        .map_err(|_| "文件监听状态锁不可用".to_string())?;
    *guard = None;
    let mut targets = state
        .file_targets
        .lock()
        .map_err(|_| "文件监听状态锁不可用".to_string())?;
    targets.clear();
    Ok(())
}

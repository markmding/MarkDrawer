// MARK#EZVE.COM
mod commands;
mod encoding;
mod error;
mod index;
mod launch;
mod paths;

pub use commands::*;

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// First document handed over by Windows (double-click / "open with" / CLI)
/// before the webview was ready to receive the `open-file` event.
#[derive(Default)]
struct LaunchState(Mutex<Option<String>>);

#[tauri::command]
fn take_launch_file(state: tauri::State<'_, LaunchState>) -> Option<String> {
    state.0.lock().ok().and_then(|mut slot| slot.take())
}

/// Hands a path to the frontend: remembers it for `take_launch_file` and
/// notifies an already-running window.
fn queue_launch_file(app: &tauri::AppHandle, path: PathBuf) {
    let value = path.to_string_lossy().to_string();
    if let Some(state) = app.try_state::<LaunchState>() {
        if let Ok(mut slot) = state.0.lock() {
            *slot = Some(value.clone());
        }
    }
    let _ = app.emit("open-file", value);
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first: a second launch forwards its argv here and
        // exits, so double-clicking files reuses the open window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            if let Some(path) = launch::file_from_args(argv, Some(Path::new(&cwd))) {
                queue_launch_file(app, path);
            }
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState::default())
        .manage(LaunchState::default())
        .invoke_handler(tauri::generate_handler![
            open_drawer,
            read_doc,
            write_doc,
            create_entry,
            rename_entry,
            delete_entry,
            save_attachment,
            read_attachment,
            list_app_assets,
            search_drawer,
            watch_drawer,
            unwatch_drawer,
            write_export_files,
            write_export_file,
            take_launch_file
        ])
        .setup(|app| {
            // Shared app folders live next to the executable, never in drawers.
            if let Err(error) = paths::ensure_app_dirs() {
                eprintln!("无法创建程序目录资源文件夹：{error}");
            }
            if let Some(path) = launch::file_from_args(std::env::args_os(), None) {
                queue_launch_file(app.handle(), path);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Mark Drawer");
}
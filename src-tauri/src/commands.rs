use crate::compress::{
    self, audio, image, video, CompressError, CompressKind, CompressResult, ProgressPayload,
};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Window};
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn compress_file(
    app: AppHandle,
    window: Window,
    path: String,
    task_id: String,
) -> Result<CompressResult, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err(CompressError::NotFound(path).into_string());
    }

    let kind = compress::detect_kind(&input).map_err(|e| e.into_string())?;

    let _ = window.emit(
        "compress://progress",
        ProgressPayload {
            task_id: task_id.clone(),
            percent: 0.0,
            stage: "starting".to_string(),
            message: "Starting compression".to_string(),
        },
    );

    let result = match kind {
        CompressKind::Video => video::compress(&app, &task_id, &input)
            .await
            .map_err(|e| e.into_string())?,
        CompressKind::Audio => audio::compress(&app, &task_id, &input)
            .await
            .map_err(|e| e.into_string())?,
        CompressKind::Image => image::compress(&input).map_err(|e| e.into_string())?,
    };

    let _ = window.emit(
        "compress://progress",
        ProgressPayload {
            task_id,
            percent: 100.0,
            stage: "done".to_string(),
            message: "Compression complete".to_string(),
        },
    );

    Ok(result)
}

#[tauri::command]
pub async fn check_ffmpeg_ready(app: AppHandle) -> Result<bool, String> {
    let sidecar = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?;

    let output = sidecar
        .args(["-version"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(output.status.success())
}

#[tauri::command]
pub fn open_output_folder(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(path);
    let folder = file_path
        .parent()
        .ok_or_else(|| "Could not determine output folder".to_string())?;

    tauri_plugin_opener::open_path(folder.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())
}

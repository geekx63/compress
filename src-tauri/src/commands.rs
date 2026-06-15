use crate::compress::{
    self, audio, image, video, CompressError, CompressKind, CompressResult, ProgressPayload,
    VideoSize,
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
    output_dir: String,
    video_size: Option<String>,
) -> Result<CompressResult, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err(CompressError::NotFound(path).into_string());
    }

    let out_dir = PathBuf::from(&output_dir);
    compress::validate_output_dir(&out_dir).map_err(|e| e.into_string())?;

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
        CompressKind::Video => {
            let size = video_size
                .as_deref()
                .map(VideoSize::from_str)
                .transpose()
                .map_err(|e| e.into_string())?
                .unwrap_or(VideoSize::W2000);
            let output = video::output_for(&input, &out_dir);
            video::compress(&app, &task_id, &input, &output, size)
                .await
                .map_err(|e| e.into_string())?
        }
        CompressKind::Audio => {
            let output = audio::output_for(&input, &out_dir);
            audio::compress(&app, &task_id, &input, &output)
                .await
                .map_err(|e| e.into_string())?
        }
        CompressKind::Image => {
            let output = image::output_for(&input, &out_dir);
            image::compress(&input, &output).map_err(|e| e.into_string())?
        }
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
pub async fn detect_file_kind(path: String) -> Result<String, String> {
    let input = PathBuf::from(&path);
    compress::detect_kind(&input)
        .map(|k| k.as_str().to_string())
        .map_err(|e| e.into_string())
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

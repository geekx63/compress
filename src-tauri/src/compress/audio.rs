use super::ffmpeg::run_ffmpeg;
use super::{finalize_output, output_path_for, CompressError, CompressKind, CompressResult};
use std::path::Path;
use tauri::AppHandle;

pub async fn compress(
    app: &AppHandle,
    task_id: &str,
    input: &Path,
    output: &Path,
) -> Result<CompressResult, CompressError> {
    run_ffmpeg(
        app,
        task_id,
        input,
        output,
        &[
            "-c:a",
            "libmp3lame",
            "-q:a",
            "6",
            "-ar",
            "16000",
            "-map_metadata",
            "-1",
        ],
    )
    .await?;

    finalize_output(input, output, &CompressKind::Audio)
}

pub fn output_for(input: &Path, output_dir: &Path) -> std::path::PathBuf {
    output_path_for(input, &CompressKind::Audio, output_dir)
}

use super::ffmpeg::run_ffmpeg;
use super::{finalize_output, output_path_for, CompressError, CompressKind, CompressResult};
use std::path::Path;
use tauri::AppHandle;

pub async fn compress(
    app: &AppHandle,
    task_id: &str,
    input: &Path,
) -> Result<CompressResult, CompressError> {
    let output = output_path_for(input, &CompressKind::Video);
    run_ffmpeg(
        app,
        task_id,
        input,
        &output,
        &[
            "-vf",
            "scale=2000:-2",
            "-c:v",
            "libx264",
            "-crf",
            "26",
            "-tune",
            "animation",
            "-preset",
            "medium",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
        ],
    )
    .await?;

    finalize_output(input, &output, &CompressKind::Video)
}

use super::ffmpeg::run_ffmpeg;
use super::{finalize_output, output_path_for, CompressError, CompressKind, CompressResult, VideoSize};
use std::path::Path;
use tauri::AppHandle;

pub async fn compress(
    app: &AppHandle,
    task_id: &str,
    input: &Path,
    output: &Path,
    video_size: VideoSize,
) -> Result<CompressResult, CompressError> {
    let scale_args: &[&str] = match video_size {
        VideoSize::W1920 => &["-vf", "scale=1920:-2"],
        VideoSize::W2000 => &["-vf", "scale=2000:-2"],
        VideoSize::Original => &[],
    };

    let encode_args = [
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
    ];

    let extra: Vec<&str> = scale_args.iter().copied().chain(encode_args).collect();

    run_ffmpeg(app, task_id, input, output, &extra).await?;

    finalize_output(input, output, &CompressKind::Video)
}

pub fn output_for(input: &Path, output_dir: &Path) -> std::path::PathBuf {
    output_path_for(input, &CompressKind::Video, output_dir)
}

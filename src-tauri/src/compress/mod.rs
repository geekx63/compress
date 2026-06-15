use serde::Serialize;
use std::path::{Path, PathBuf};
use thiserror::Error;

pub mod audio;
pub mod ffmpeg;
pub mod image;
pub mod video;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CompressKind {
    Video,
    Audio,
    Image,
}

impl CompressKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Video => "video",
            Self::Audio => "audio",
            Self::Image => "image",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CompressStatus {
    Completed,
    Skipped,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompressResult {
    pub input_path: String,
    pub output_path: String,
    pub input_size: u64,
    pub output_size: u64,
    pub ratio: f32,
    pub kind: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProgressPayload {
    pub task_id: String,
    pub percent: f32,
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Error)]
pub enum CompressError {
    #[error("unsupported file format: {0}")]
    UnsupportedFormat(String),
    #[error("file not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("image error: {0}")]
    Image(String),
    #[error("ffmpeg error: {0}")]
    Ffmpeg(String),
}

impl CompressError {
    pub fn into_string(self) -> String {
        self.to_string()
    }
}

pub fn detect_kind(path: &Path) -> Result<CompressKind, CompressError> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .ok_or_else(|| CompressError::UnsupportedFormat(path.display().to_string()))?;

    match ext.as_str() {
        "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v" | "flv" | "wmv" => Ok(CompressKind::Video),
        "wav" | "flac" | "aac" | "mp3" | "m4a" | "ogg" | "wma" | "opus" => Ok(CompressKind::Audio),
        "png" | "jpg" | "jpeg" => Ok(CompressKind::Image),
        _ => Err(CompressError::UnsupportedFormat(ext)),
    }
}

pub fn output_path_for(input: &Path, kind: &CompressKind) -> PathBuf {
    let parent = input.parent().unwrap_or_else(|| Path::new("."));
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");

    let ext = match kind {
        CompressKind::Audio => "mp3",
        CompressKind::Video => input
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("mp4"),
        CompressKind::Image => input
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png"),
    };

    parent.join(format!("{stem}_compressed.{ext}"))
}

pub fn build_result(
    input: &Path,
    output: &Path,
    kind: &CompressKind,
    status: CompressStatus,
) -> Result<CompressResult, CompressError> {
    let input_size = std::fs::metadata(input)?.len();
    let output_size = std::fs::metadata(output)?.len();
    let ratio = if input_size > 0 {
        ((input_size as f64 - output_size as f64) / input_size as f64 * 100.0) as f32
    } else {
        0.0
    };

    Ok(CompressResult {
        input_path: input.display().to_string(),
        output_path: output.display().to_string(),
        input_size,
        output_size,
        ratio,
        kind: kind.as_str().to_string(),
        status: match status {
            CompressStatus::Completed => "completed".to_string(),
            CompressStatus::Skipped => "skipped".to_string(),
        },
    })
}

pub fn finalize_output(
    input: &Path,
    output: &Path,
    kind: &CompressKind,
) -> Result<CompressResult, CompressError> {
    let input_size = std::fs::metadata(input)?.len();
    let output_size = std::fs::metadata(output)?.len();

    if output_size >= input_size {
        std::fs::remove_file(output)?;
        return build_result(input, input, kind, CompressStatus::Skipped);
    }

    build_result(input, output, kind, CompressStatus::Completed)
}

use super::{CompressError, ProgressPayload};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

pub async fn run_ffmpeg(
    app: &AppHandle,
    task_id: &str,
    input: &Path,
    output: &Path,
    extra_args: &[&str],
) -> Result<(), CompressError> {
    if !input.exists() {
        return Err(CompressError::NotFound(input.display().to_string()));
    }

    let mut args = vec!["-i", input.to_str().unwrap(), "-hide_banner"];
    args.extend(extra_args);
    args.push("-y");
    args.push(output.to_str().unwrap());

    let sidecar = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| CompressError::Ffmpeg(e.to_string()))?;

    let (mut rx, _child) = sidecar
        .args(args)
        .spawn()
        .map_err(|e| CompressError::Ffmpeg(e.to_string()))?;

    let task_id = Arc::new(task_id.to_string());
    let app_handle = app.clone();
    let mut duration_secs: Option<f64> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                let text = String::from_utf8_lossy(&line);
                if duration_secs.is_none() {
                    if let Some(d) = parse_duration(&text) {
                        duration_secs = Some(d);
                    }
                }
                if let (Some(total), Some(current)) = (duration_secs, parse_time(&text)) {
                    let percent = ((current / total) * 100.0).min(99.0) as f32;
                    let _ = app_handle.emit(
                        "compress://progress",
                        ProgressPayload {
                            task_id: task_id.to_string(),
                            percent,
                            stage: "encoding".to_string(),
                            message: format!("Encoding {:.0}%", percent),
                        },
                    );
                }
            }
            CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                    return Err(CompressError::Ffmpeg(format!(
                        "ffmpeg exited with code {:?}",
                        payload.code
                    )));
                }
            }
            CommandEvent::Error(err) => {
                return Err(CompressError::Ffmpeg(err));
            }
            _ => {}
        }
    }

    if !output.exists() {
        return Err(CompressError::Ffmpeg(
            "ffmpeg finished without creating output file".to_string(),
        ));
    }

    Ok(())
}

fn parse_duration(line: &str) -> Option<f64> {
    let marker = "Duration:";
    let idx = line.find(marker)?;
    let rest = &line[idx + marker.len()..];
    let time_part = rest.trim().split(',').next()?.trim();
    parse_hms(time_part)
}

fn parse_time(line: &str) -> Option<f64> {
    let marker = "time=";
    let idx = line.find(marker)?;
    let rest = &line[idx + marker.len()..];
    let time_part = rest.split_whitespace().next()?;
    parse_hms(time_part)
}

fn parse_hms(value: &str) -> Option<f64> {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";

export type TaskStatus =
  | "queued"
  | "compressing"
  | "completed"
  | "skipped"
  | "failed";

export type VideoSizeOption = "w1920" | "w2000" | "original";

export interface PendingFile {
  path: string;
  fileName: string;
  kind?: string;
}

export interface CompressTask {
  id: string;
  path: string;
  fileName: string;
  status: TaskStatus;
  percent: number;
  message: string;
  inputSize?: number;
  outputSize?: number;
  outputPath?: string;
  ratio?: number;
  kind?: string;
  error?: string;
}

export interface CompressResult {
  input_path: string;
  output_path: string;
  input_size: number;
  output_size: number;
  ratio: number;
  kind: string;
  status: string;
}

export interface ExportSettings {
  outputDir: string;
  videoSize: VideoSizeOption;
}

interface ProgressPayload {
  task_id: string;
  percent: number;
  stage: string;
  message: string;
}

function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

async function detectKind(path: string): Promise<string | undefined> {
  try {
    return await invoke<string>("detect_file_kind", { path });
  } catch {
    return undefined;
  }
}

export function useCompress() {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [tasks, setTasks] = useState<CompressTask[]>([]);
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const hasVideo = pendingFiles.some((f) => f.kind === "video");

  useEffect(() => {
    invoke<boolean>("check_ffmpeg_ready")
      .then(setFfmpegReady)
      .catch(() => setFfmpegReady(false));
  }, []);

  useEffect(() => {
    const unlisten = listen<ProgressPayload>("compress://progress", (event) => {
      const { task_id, percent, message } = event.payload;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === task_id
            ? {
                ...task,
                status: percent >= 100 ? task.status : "compressing",
                percent,
                message,
              }
            : task,
        ),
      );
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<CompressTask>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }, []);

  const addFiles = useCallback((paths: string[]) => {
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.path));
      const additions: PendingFile[] = [];

      for (const path of paths) {
        if (existing.has(path)) continue;
        existing.add(path);
        additions.push({
          path,
          fileName: fileNameFromPath(path),
        });
      }

      if (additions.length === 0) return prev;

      void (async () => {
        const withKinds = await Promise.all(
          additions.map(async (file) => ({
            ...file,
            kind: await detectKind(file.path),
          })),
        );
        setPendingFiles((current) => {
          const pathsSet = new Set(current.map((f) => f.path));
          const merged = [...current];
          for (const file of withKinds) {
            if (!pathsSet.has(file.path)) {
              merged.push(file);
              pathsSet.add(file.path);
            } else {
              const idx = merged.findIndex((f) => f.path === file.path);
              if (idx >= 0 && file.kind) {
                merged[idx] = { ...merged[idx], kind: file.kind };
              }
            }
          }
          return merged;
        });
      })();

      return [...prev, ...additions];
    });
  }, []);

  const removeFile = useCallback((path: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const compressOne = useCallback(
    async (path: string, settings: ExportSettings, kind?: string) => {
      const id = crypto.randomUUID();
      const task: CompressTask = {
        id,
        path,
        fileName: fileNameFromPath(path),
        status: "queued",
        percent: 0,
        message: "Queued",
        kind,
      };

      setTasks((prev) => [task, ...prev]);

      try {
        updateTask(id, { status: "compressing", message: "Compressing..." });
        const result = await invoke<CompressResult>("compress_file", {
          path,
          taskId: id,
          outputDir: settings.outputDir,
          videoSize: kind === "video" ? settings.videoSize : null,
        });

        updateTask(id, {
          status: result.status === "skipped" ? "skipped" : "completed",
          percent: 100,
          message:
            result.status === "skipped"
              ? "Already optimized, kept original"
              : "Done",
          inputSize: result.input_size,
          outputSize: result.output_size,
          outputPath: result.output_path,
          ratio: result.ratio,
          kind: result.kind,
        });
      } catch (error) {
        updateTask(id, {
          status: "failed",
          message: "Failed",
          error: String(error),
        });
      }
    },
    [updateTask],
  );

  const startExport = useCallback(
    async (settings: ExportSettings) => {
      const files = [...pendingFiles];
      setPendingFiles([]);
      setExportOpen(false);

      for (const file of files) {
        await compressOne(file.path, settings, file.kind);
      }
    },
    [pendingFiles, compressOne],
  );

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    addFiles(paths);
  }, [addFiles]);

  useEffect(() => {
    let unlistenDrop: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          addFiles(event.payload.paths);
        }
      })
      .then((fn) => {
        unlistenDrop = fn;
      });

    return () => {
      unlistenDrop?.();
    };
  }, [addFiles]);

  const openFolder = useCallback(async (outputPath: string) => {
    await invoke("open_output_folder", { path: outputPath });
  }, []);

  return {
    pendingFiles,
    tasks,
    ffmpegReady,
    hasVideo,
    exportOpen,
    setExportOpen,
    pickFiles,
    addFiles,
    removeFile,
    startExport,
    openFolder,
  };
}

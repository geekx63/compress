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

export function useCompress() {
  const [tasks, setTasks] = useState<CompressTask[]>([]);
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);

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

  const compressOne = useCallback(
    async (path: string) => {
      const id = crypto.randomUUID();
      const task: CompressTask = {
        id,
        path,
        fileName: fileNameFromPath(path),
        status: "queued",
        percent: 0,
        message: "Queued",
      };

      setTasks((prev) => [task, ...prev]);

      try {
        updateTask(id, { status: "compressing", message: "Compressing..." });
        const result = await invoke<CompressResult>("compress_file", {
          path,
          taskId: id,
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

  const addFiles = useCallback(
    (paths: string[]) => {
      paths.forEach((path) => {
        void compressOne(path);
      });
    },
    [compressOne],
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
    tasks,
    ffmpegReady,
    pickFiles,
    addFiles,
    openFolder,
  };
}

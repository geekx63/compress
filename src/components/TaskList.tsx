import type { CompressTask } from "../hooks/useCompress";

interface TaskListProps {
  tasks: CompressTask[];
  onOpenFolder: (path: string) => void;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function kindLabel(kind?: string): string {
  switch (kind) {
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "image":
      return "Image";
    default:
      return "File";
  }
}

function statusLabel(task: CompressTask): string {
  switch (task.status) {
    case "queued":
      return "Queued";
    case "compressing":
      return "Compressing";
    case "completed":
      return "Completed";
    case "skipped":
      return "Skipped";
    case "failed":
      return "Failed";
    default:
      return task.status;
  }
}

export function TaskList({ tasks, onOpenFolder }: TaskListProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="task-list">
      <h3>Tasks</h3>
      <ul>
        {tasks.map((task) => (
          <li key={task.id} className={`task task-${task.status}`}>
            <div className="task-header">
              <div className="task-title">
                <span className="task-name">{task.fileName}</span>
                {task.kind && (
                  <span className={`badge badge-${task.kind}`}>
                    {kindLabel(task.kind)}
                  </span>
                )}
              </div>
              <span className={`status status-${task.status}`}>
                {statusLabel(task)}
              </span>
            </div>

            {(task.status === "compressing" || task.status === "queued") && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.max(task.percent, 4)}%` }}
                />
              </div>
            )}

            {task.status === "completed" && task.ratio !== undefined && (
              <div className="task-result">
                <span>
                  {formatBytes(task.inputSize)} → {formatBytes(task.outputSize)}
                </span>
                <span className="ratio">-{task.ratio.toFixed(1)}%</span>
                {task.outputPath && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => onOpenFolder(task.outputPath!)}
                  >
                    Open folder
                  </button>
                )}
              </div>
            )}

            {task.status === "skipped" && (
              <p className="task-note">Already optimized — original kept</p>
            )}

            {task.status === "failed" && (
              <p className="task-error">{task.error ?? "Compression failed"}</p>
            )}

            {task.message && task.status === "compressing" && (
              <p className="task-message">{task.message}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

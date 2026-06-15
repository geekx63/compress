import type { PendingFile } from "../hooks/useCompress";

interface FileQueueProps {
  files: PendingFile[];
  onRemove: (path: string) => void;
}

function kindLabel(kind?: string): string {
  switch (kind) {
    case "video":
      return "视频";
    case "audio":
      return "音频";
    case "image":
      return "图片";
    default:
      return "文件";
  }
}

export function FileQueue({ files, onRemove }: FileQueueProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <section className="file-queue">
      <h3>待导出（{files.length}）</h3>
      <ul>
        {files.map((file) => (
          <li key={file.path} className="queue-item">
            <div className="queue-item-info">
              <span className="queue-name">{file.fileName}</span>
              {file.kind && (
                <span className={`badge badge-${file.kind}`}>
                  {kindLabel(file.kind)}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-remove"
              onClick={() => onRemove(file.path)}
              aria-label="移除"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

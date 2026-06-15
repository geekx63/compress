import type { ExportSettings, VideoSizeOption } from "../hooks/useCompress";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

interface ExportDialogProps {
  open: boolean;
  hasVideo: boolean;
  onClose: () => void;
  onConfirm: (settings: ExportSettings) => void;
}

const VIDEO_SIZE_OPTIONS: { value: VideoSizeOption; label: string }[] = [
  { value: "w2000", label: "2000 × 1000（宽 2000，高按比例）" },
  { value: "w1920", label: "1920 × 1080（宽 1920，高按比例）" },
  { value: "original", label: "原比例（不缩放）" },
];

export function ExportDialog({
  open: isOpen,
  hasVideo,
  onClose,
  onConfirm,
}: ExportDialogProps) {
  const [outputDir, setOutputDir] = useState("");
  const [videoSize, setVideoSize] = useState<VideoSizeOption>("w2000");

  if (!isOpen) return null;

  const pickDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setOutputDir(selected);
    }
  };

  const handleConfirm = () => {
    if (!outputDir) return;
    onConfirm({ outputDir, videoSize });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>导出设置</h2>

        <div className="dialog-field">
          <label>保存目录</label>
          <div className="dir-picker">
            <input
              type="text"
              readOnly
              value={outputDir}
              placeholder="请选择保存目录"
            />
            <button type="button" onClick={() => void pickDirectory()}>
              浏览
            </button>
          </div>
        </div>

        {hasVideo && (
          <div className="dialog-field">
            <label>视频目标尺寸</label>
            <div className="radio-group">
              {VIDEO_SIZE_OPTIONS.map((opt) => (
                <label key={opt.value} className="radio-item">
                  <input
                    type="radio"
                    name="videoSize"
                    value={opt.value}
                    checked={videoSize === opt.value}
                    onChange={() => setVideoSize(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!outputDir}
            onClick={handleConfirm}
          >
            开始导出
          </button>
        </div>
      </div>
    </div>
  );
}

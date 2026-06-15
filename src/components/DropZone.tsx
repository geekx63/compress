interface DropZoneProps {
  onPickFiles: () => void;
}

export function DropZone({ onPickFiles }: DropZoneProps) {
  return (
    <div className="drop-zone" onClick={onPickFiles}>
      <div className="drop-zone-inner">
        <div className="drop-icon">↓</div>
        <h2>拖入文件到此处</h2>
        <p>视频 · 音频 · 图片 — 或点击选择文件</p>
        <div className="format-badges">
          <span>MP4 MOV MKV</span>
          <span>WAV MP3 FLAC</span>
          <span>PNG JPG</span>
        </div>
      </div>
    </div>
  );
}

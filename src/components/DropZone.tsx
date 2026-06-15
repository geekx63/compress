interface DropZoneProps {
  onPickFiles: () => void;
}

export function DropZone({ onPickFiles }: DropZoneProps) {
  return (
    <div className="drop-zone" onClick={onPickFiles}>
      <div className="drop-zone-inner">
        <div className="drop-icon">↓</div>
        <h2>Drop files here to compress</h2>
        <p>Video · Audio · Image — or click to browse</p>
        <div className="format-badges">
          <span>MP4 MOV MKV</span>
          <span>WAV MP3 FLAC</span>
          <span>PNG JPG</span>
        </div>
      </div>
    </div>
  );
}

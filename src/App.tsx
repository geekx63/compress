import { DropZone } from "./components/DropZone";
import { ExportDialog } from "./components/ExportDialog";
import { FileQueue } from "./components/FileQueue";
import { TaskList } from "./components/TaskList";
import { useCompress } from "./hooks/useCompress";
import "./App.css";

function App() {
  const {
    pendingFiles,
    tasks,
    ffmpegReady,
    hasVideo,
    exportOpen,
    setExportOpen,
    pickFiles,
    removeFile,
    startExport,
    openFolder,
  } = useCompress();

  return (
    <main className="app">
      <header className="app-header">
        <h1>Compress</h1>
        <p className="subtitle">视频 · 音频 · 图片压缩导出</p>
      </header>

      <DropZone onPickFiles={() => void pickFiles()} />
      <FileQueue files={pendingFiles} onRemove={removeFile} />

      {pendingFiles.length > 0 && (
        <div className="export-bar">
          <button
            type="button"
            className="btn-primary btn-export"
            onClick={() => setExportOpen(true)}
          >
            导出
          </button>
        </div>
      )}

      <ExportDialog
        open={exportOpen}
        hasVideo={hasVideo}
        onClose={() => setExportOpen(false)}
        onConfirm={(settings) => void startExport(settings)}
      />

      <TaskList tasks={tasks} onOpenFolder={(path) => void openFolder(path)} />

      <footer className="app-footer">
        <span
          className={`ffmpeg-status ${ffmpegReady ? "ready" : ffmpegReady === false ? "missing" : ""}`}
        >
          ffmpeg:{" "}
          {ffmpegReady === null
            ? "checking..."
            : ffmpegReady
              ? "ready"
              : "not found — run npm run fetch-ffmpeg"}
        </span>
      </footer>
    </main>
  );
}

export default App;

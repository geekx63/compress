import { DropZone } from "./components/DropZone";
import { TaskList } from "./components/TaskList";
import { useCompress } from "./hooks/useCompress";
import "./App.css";

function App() {
  const { tasks, ffmpegReady, pickFiles, openFolder } = useCompress();

  return (
    <main className="app">
      <header className="app-header">
        <h1>Compress</h1>
        <p className="subtitle">
          Cross-platform video, audio &amp; image compression
        </p>
      </header>

      <DropZone onPickFiles={() => void pickFiles()} />
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

#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const binariesDir = path.join(root, "src-tauri", "binaries");

// BtbN no longer ships macOS builds; Tyrrrz/FFmpegBin covers all targets as zip.
const RELEASE_BASE =
  "https://github.com/Tyrrrz/FFmpegBin/releases/latest/download";

const TARGET_MAP = {
  "aarch64-apple-darwin": {
    asset: "ffmpeg-osx-arm64.zip",
    ext: "",
  },
  "x86_64-apple-darwin": {
    asset: "ffmpeg-osx-x64.zip",
    ext: "",
  },
  "x86_64-unknown-linux-gnu": {
    asset: "ffmpeg-linux-x64.zip",
    ext: "",
  },
  "x86_64-pc-windows-msvc": {
    asset: "ffmpeg-windows-x64.zip",
    ext: ".exe",
  },
};

function getTargetTriple() {
  if (process.env.TARGET_TRIPLE) {
    return process.env.TARGET_TRIPLE;
  }
  const output = execSync("rustc -vV", { encoding: "utf8" });
  const match = output.match(/host: (.+)/);
  if (!match) {
    throw new Error("Failed to determine Rust host triple");
  }
  return match[1].trim();
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl) => {
      https
        .get(currentUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            request(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode} ${currentUrl}`));
            return;
          }
          pipeline(res, createWriteStream(dest)).then(resolve).catch(reject);
        })
        .on("error", reject);
    };
    request(url);
  });
}

function findFileRecursive(dir, fileName) {
  const target = fileName.toLowerCase();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, fileName);
      if (found) return found;
    } else if (entry.name.toLowerCase() === target) {
      return fullPath;
    }
  }
  return null;
}

function extractZip(archivePath, tmpDir) {
  execSync(`tar -xf "${archivePath}" -C "${tmpDir}"`, { stdio: "inherit" });
}

async function main() {
  const triple = getTargetTriple();
  const config = TARGET_MAP[triple];
  if (!config) {
    throw new Error(`Unsupported target triple: ${triple}`);
  }

  fs.mkdirSync(binariesDir, { recursive: true });

  const destName = `ffmpeg-${triple}${config.ext}`;
  const destPath = path.join(binariesDir, destName);

  if (fs.existsSync(destPath)) {
    console.log(`ffmpeg already exists: ${destPath}`);
    return;
  }

  const archivePath = path.join(binariesDir, config.asset);
  const url = `${RELEASE_BASE}/${config.asset}`;

  console.log(`Downloading ffmpeg for ${triple}...`);
  console.log(url);
  await download(url, archivePath);

  const tmpDir = path.join(binariesDir, "ffmpeg-extract");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  extractZip(archivePath, tmpDir);

  const ffmpegName = config.ext ? "ffmpeg.exe" : "ffmpeg";
  const found = findFileRecursive(tmpDir, ffmpegName);

  if (!found) {
    throw new Error(`ffmpeg binary not found in archive (looking for ${ffmpegName})`);
  }

  fs.copyFileSync(found, destPath);
  if (process.platform !== "win32") {
    fs.chmodSync(destPath, 0o755);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(archivePath, { force: true });

  console.log(`Installed ffmpeg sidecar: ${destPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

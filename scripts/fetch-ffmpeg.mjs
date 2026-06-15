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

const RELEASE_BASE =
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest";

const TARGET_MAP = {
  "aarch64-apple-darwin": {
    asset: "ffmpeg-master-latest-macosarm64-gpl.tar.xz",
    ext: "",
  },
  "x86_64-apple-darwin": {
    asset: "ffmpeg-master-latest-macos64-gpl.tar.xz",
    ext: "",
  },
  "x86_64-unknown-linux-gnu": {
    asset: "ffmpeg-master-latest-linux64-gpl.tar.xz",
    ext: "",
  },
  "x86_64-pc-windows-msvc": {
    asset: "ffmpeg-master-latest-win64-gpl.zip",
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

  if (config.asset.endsWith(".tar.xz")) {
    execSync(`tar -xJf "${archivePath}" -C "${tmpDir}"`, { stdio: "inherit" });
  } else {
    execSync(`unzip -q "${archivePath}" -d "${tmpDir}"`, { stdio: "inherit" });
  }

  const ffmpegName = config.ext ? "ffmpeg.exe" : "ffmpeg";
  const found = execSync(`find "${tmpDir}" -name "${ffmpegName}" -type f`, {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)[0];

  if (!found) {
    throw new Error("ffmpeg binary not found in archive");
  }

  fs.copyFileSync(found, destPath);
  fs.chmodSync(destPath, 0o755);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(archivePath, { force: true });

  console.log(`Installed ffmpeg sidecar: ${destPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

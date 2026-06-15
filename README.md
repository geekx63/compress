# Compress

Cross-platform desktop compression tool built with Tauri 2. Drag and drop files to compress video, audio, or images with sensible defaults — no manual ffmpeg install required.

## Features

- **Video** — scale 1920px width, H.264 CRF 26 (`-tune animation -preset medium`) + AAC @ 96k
- **Audio** — MP3 via LAME q:a 6, 16 kHz, metadata stripped
- **Image** — TinyPNG-style pipeline:
  - PNG: `imagequant` (quality 65–80) + `oxipng`
  - JPEG: `mozjpeg` quality 82, progressive

Output files are saved next to the source as `{name}_compressed.{ext}`. If compression would not reduce file size, the original is kept.

## Supported formats

| Type  | Input |
|-------|-------|
| Video | MP4, MOV, AVI, MKV, WebM, M4V, FLV, WMV |
| Audio | WAV, FLAC, AAC, MP3, M4A, OGG, WMA, OPUS |
| Image | PNG, JPG, JPEG |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) stable (1.85+ recommended)

## Setup

```bash
npm install
npm run fetch-ffmpeg   # downloads ffmpeg sidecar for your platform
npm run tauri dev
```

If `fetch-ffmpeg` fails (network), copy a local ffmpeg binary:

```bash
cp "$(which ffmpeg)" src-tauri/binaries/ffmpeg-$(rustc -vV | grep host | cut -d' ' -f2)
```

## Build

```bash
npm run fetch-ffmpeg
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/`.

## License

GPL-3.0-or-later — required by `imagequant` (same family as pngquant / TinyPNG PNG compression).
# compress

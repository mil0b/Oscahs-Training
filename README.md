# Oscahs Training Library

A Windows desktop app (built with [Tauri](https://tauri.app)) for browsing and playing the OSCAHS staff training videos. Videos are read directly from the team's Dropbox sync folder — no server, no streaming, no internet required once videos are synced.

## Features

- **Video library** — grid view with category filters, search-friendly cards, and chapter counts
- **Full player** — seek bar, volume, playback speed, chapters panel, fullscreen, keyboard shortcuts
- **Dark mode** — persists across sessions
- **Admin mode** — a password-gated panel inside the app for editing video titles, descriptions, categories, and chapters. Changes are written to `videos.json` in the shared Dropbox folder and sync to every installed copy automatically — no app update required for content changes
- **Auto-updates** — the app checks GitHub Releases on startup and can download and install new versions in place

## Getting started (development)

**Prerequisites**

1. [Rust](https://rustup.rs)
2. [Tauri CLI](https://tauri.app): `cargo install tauri-cli --version "^2" --locked`
3. WebView2 (preinstalled on Windows 10/11)

**Run the app**

```bash
cd src-tauri
cargo tauri dev
```

The app window opens automatically. Edits to `ui/index.html` hot-reload; Rust changes recompile in a few seconds.

## How videos are discovered

On launch, the Rust backend finds the user's Dropbox folder (via `%LOCALAPPDATA%\Dropbox\info.json`) and scans:

```
{Dropbox root}\Oscahs Team\Magicbooking Training\
```

Any `.mp4` file there appears in the library automatically, with a title generated from its filename. Dropping a new video into that folder is all that's needed to add it for everyone.

### Custom metadata

An optional `videos.json` in the same folder overrides titles, descriptions, categories, and chapter marks per file:

```json
[
  {
    "filename": "registers.mp4",
    "title": "Till Registers",
    "description": "How to open, use, and close the registers.",
    "category": "MagicBooking",
    "chapters": [
      { "time": 0, "title": "Introduction" },
      { "time": 45, "title": "Opening the register" }
    ]
  }
]
```

This file is normally managed through **Admin mode** in the app (gear icon, top right) rather than edited by hand.

## Building the Windows installer

```bash
cd src-tauri
cargo tauri build
```

Output: `src-tauri/target/release/bundle/msi/Oscahs Training_<version>_x64_en-US.msi`

## Shipping an update

1. Bump `version` in `src-tauri/tauri.conf.json`.
2. Commit, then tag and push:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. The `Release` GitHub Actions workflow builds, signs, and publishes a GitHub Release with the installer and an update manifest.
4. Every installed app checks that release on startup and offers an in-app update — no manual reinstall needed.

This requires two repository secrets to be set under **Settings → Secrets and variables → Actions**:

- `TAURI_SIGNING_PRIVATE_KEY` — the updater's private signing key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password

(Pushing to `main` without a tag just builds a downloadable artifact via the `Build Windows Installer` workflow — it does not create a signed release or trigger updates.)

## Project structure

```
ui/                         Frontend (HTML/CSS/JS, no build step)
  index.html                 Library grid, player, admin panel, updater UI
  oscahs-logo.svg / oscahs-logo-white.svg
  fonts/                      Solomon Sans webfonts
src-tauri/
  src/lib.rs                  Video scanning, admin auth, updater wiring
  tauri.conf.json              App + updater config
  capabilities/default.json    Permission grants
.github/workflows/
  build-windows.yml            Builds an installer artifact on every push to main
  release.yml                  Builds, signs, and publishes a GitHub Release on version tags
```

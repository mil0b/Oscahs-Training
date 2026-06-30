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

## Development workflow

There are two GitHub Actions workflows. Understanding the difference between them is the key to the whole pipeline:

| What you do | Workflow that runs | What it produces | Triggers staff auto-updates? |
|---|---|---|---|
| `git push` to `main` | `Build Windows Installer` | Downloadable MSI artifact in Actions (expires after 90 days) | **No** |
| `git tag vX.Y.Z && git push origin vX.Y.Z` | `Release` | Signed GitHub Release + `latest.json` | **Yes** |

This gives you an implicit staging step: push your changes, download the artifact from the Actions run, install it on a test machine, and verify it before tagging. Only the tag triggers the release that auto-updates all staff.

### Day-to-day change cycle

1. Make and test changes locally:
   ```bash
   cd src-tauri
   cargo tauri dev
   ```
2. Push to `main` for a test build:
   ```bash
   git add <files>
   git commit -m "..."
   git push
   ```
3. Go to **Actions → Build Windows Installer → latest run** and download the MSI artifact. Install it on a test machine and verify.
4. When happy, bump `version` in `src-tauri/tauri.conf.json` (e.g. `0.1.0` → `0.2.0`), commit, then tag and push:
   ```bash
   git add src-tauri/tauri.conf.json
   git commit -m "Release v0.2.0"
   git push
   git tag v0.2.0
   git push origin v0.2.0
   ```
5. The `Release` workflow builds, signs, and publishes a GitHub Release with the installer and update manifest. Every installed copy of the app checks on next launch and auto-updates — no manual reinstall needed.

### Required repository secrets

Set these under **Settings → Secrets and variables → Actions** before the `Release` workflow can sign and publish:

- `TAURI_SIGNING_PRIVATE_KEY` — the updater's Ed25519 private key (generated with `cargo tauri signer generate`)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password

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

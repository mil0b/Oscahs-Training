# Oscahs Training — Windows Setup & Handover

## What's been built

A Tauri desktop app that wraps the training video player. When staff open it, the Rust backend scans their local Dropbox sync folder for `.mp4` files and populates the library automatically — no config needed. Videos play from local disk (fast, no streaming).

---

## Getting the code onto Windows

**Option A — Dropbox (quickest):**
Copy the `Video Player` project folder into your Dropbox so it syncs to your Windows machine. Make sure to exclude the build cache — the `.gitignore` already lists it, but Dropbox will sync everything. If you do this, delete `src-tauri/target/` before copying (it's several GB and doesn't need to move).

**Option B — GitHub (recommended for long term):**
Create a new private repo on github.com, then from this Linux machine:
```bash
git remote add origin https://github.com/YOUR_USERNAME/oscahs-training.git
git push -u origin main
```
Then on Windows: `git clone https://github.com/YOUR_USERNAME/oscahs-training.git`

---

## Prerequisites on Windows

Install these in order:

1. **Rust** — https://rustup.rs  
   Run the installer, accept defaults. This also installs `cargo`.

2. **Node.js (v20+)** — https://nodejs.org  
   Only needed for the Tauri CLI build step.

3. **Tauri CLI**  
   Open a terminal and run:
   ```
   cargo install tauri-cli --version "^2" --locked
   ```
   This takes a few minutes the first time.

4. **WebView2** — already installed on Windows 10/11 (ships with Edge). No action needed.

5. **VS Code** — https://code.visualstudio.com  
   Recommended extensions: `rust-analyzer`, `Tauri`

6. **Claude Code** — install from https://claude.ai/code

---

## Project structure

```
Video Player/
├── ui/
│   └── index.html          ← All frontend: HTML, CSS, JS (the player UI)
├── src-tauri/
│   ├── src/lib.rs          ← Rust backend: scan_videos command
│   ├── tauri.conf.json     ← App config (window size, asset protocol, identifier)
│   ├── Cargo.toml          ← Rust dependencies
│   └── icons/              ← App icons (pink play button, all sizes)
├── .github/workflows/
│   └── build-windows.yml   ← GitHub Actions: builds the MSI on every push to main
├── prototype/              ← Original standalone HTML player (kept for reference)
└── WINDOWS_SETUP.md        ← This file
```

---

## Running in development

```bash
cargo tauri dev
```

Run from the `Video Player` folder. The app window opens immediately. Any changes you save to `ui/index.html` hot-reload in the window — no restart needed. Rust changes require a recompile (~5–10 seconds).

---

## Building the Windows MSI installer

```bash
cargo tauri build
```

The MSI is output to:
```
src-tauri/target/release/bundle/msi/Oscahs Training_0.1.0_x64_en-US.msi
```

Rename it and drop it into the `Magicbooking Training` Dropbox folder. Staff double-click it once to install, then launch "Oscahs Training" from the Start menu or desktop shortcut going forward.

> **Note:** Windows may show a SmartScreen warning ("Unknown publisher") on first run since the MSI isn't code-signed. Staff click "More info → Run anyway". To eliminate this long-term, a code-signing certificate (~£70/yr) can be added to the GitHub Actions workflow.

---

## How videos are discovered

The Rust backend (`src-tauri/src/lib.rs`) looks for the Dropbox folder via `%LOCALAPPDATA%\Dropbox\info.json` (which Dropbox writes with the actual sync path, handling custom folder names like `OSCAHS Dropbox`). It then navigates to:

```
{Dropbox root}\Oscahs Team\Magicbooking Training\
```

Any `.mp4` files found there appear in the library. Titles are auto-generated from filenames (e.g. `fire-safety-2024.mp4` → "Fire Safety 2024").

### Optional metadata file

To set custom titles, descriptions, and chapter marks, add a `videos.json` to the training folder:

```json
[
  {
    "filename": "registers.mp4",
    "title": "Till Registers",
    "description": "How to open, use, and close the registers.",
    "chapters": [
      { "time": 0,   "title": "Introduction" },
      { "time": 45,  "title": "Opening the register" },
      { "time": 120, "title": "End-of-day close" }
    ]
  }
]
```

Any video not listed in `videos.json` still appears, just with an auto-generated title.

---

## GitHub Actions (automatic MSI builds)

The workflow at `.github/workflows/build-windows.yml` runs on every push to `main` using a Windows runner. To download the built MSI:

1. Go to your repo on GitHub
2. Click **Actions** → latest run → scroll to **Artifacts**
3. Download `oscahs-training-windows` — it contains the `.msi`

This means you never need to run `cargo tauri build` locally on Windows unless you want to.

---

## Key things to know

- **No server required.** The app reads files directly from the local Dropbox sync folder.
- **No internet required** once videos are synced.
- **Adding a new video:** drop the `.mp4` into the Dropbox training folder. Dropbox syncs it overnight. Staff reopen the app — it's there.
- **The `prototype/` folder** contains the original standalone HTML player. Ignore it; it's just kept for reference.
- **Linux dev vs Windows prod:** The UI renders on WebKitGTK on Linux and Edge WebView2 on Windows. They're visually identical for this app's CSS, but do a final check on Windows before distributing.

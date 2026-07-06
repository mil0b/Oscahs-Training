# Oscahs Training Library

A Windows desktop app (built with [Tauri](https://tauri.app)) for browsing and playing OSCAHS staff training videos. Videos and metadata are served from cloud storage (Cloudflare), so every installed copy of the app stays in sync automatically — no file shares, no manual distribution.

## Features

- **Video library** — grid view with category filters, search-friendly cards, and chapter counts
- **Full player** — seek bar, volume, playback speed, chapters panel, fullscreen, keyboard shortcuts
- **Dark mode** — persists across sessions
- **Admin mode** — a password-gated panel (gear icon, top right) for managing the library:
  - Edit video titles, descriptions, categories, chapters, and display order
  - Upload new videos or replace existing ones directly from the app, with a progress bar
  - Delete videos
  - Add, rename, recolor, or remove categories — no app update required
  - See how much storage is in use
  - Changes sync to every installed copy automatically, with no app update required
- **Auto-updates** — the app checks for new versions on startup and can download and install them in place

## Installing the app (staff)

### First-time installation

1. Go to the [Releases page](https://github.com/mil0b/Oscahs-Training/releases) and download the `.exe` installer from the latest release.
2. Run the installer — it will ask for admin permission (required to install to Program Files). Click through the prompts. No restart is required.
3. The app appears in your Start menu as **Oscahs Training**.

That's it. You only ever need to do this once — all future updates install themselves automatically.

### Updates

Every time you open the app it checks for a new version in the background. If one is available, a notification bar appears at the top of the window:

> **Version X.Y.Z is available.** &nbsp; [Update now] &nbsp; [×]

- Click **Update now** — the app downloads the update, installs it, and relaunches itself. The whole process takes about 30 seconds depending on your connection.
- Click **×** to dismiss and carry on. The bar will reappear next time you open the app until the update is applied.

Updates are never installed silently without your action — you always get the choice.

If the download fails (e.g. no internet at the time), the button shows a brief error message. Just close and reopen the app when you have a connection and it will try again.

### Setting up admin access

The first person to open **Admin mode** (gear icon) on a fresh install will be prompted to create the shared admin password — after that, everyone uses the same login to manage the library. If you ever lose the password, it can be reset by whoever manages the app's cloud backend.

---

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

The app has no local content of its own — videos, titles, categories, and admin credentials all live behind a small cloud backend (a Cloudflare Worker in front of R2 object storage). Maintainers: see the (gitignored, not published) technical design document for the backend's architecture, API, and operational details.

### Keyboard shortcuts

| Context | Key | Action |
|---|---|---|
| Player | `Space` / `k` | Play / pause |
| Player | `←` / `→` | Seek −10 s / +10 s |
| Player | `m` | Mute toggle |
| Player | `f` | Fullscreen |
| Player | `Escape` | Back to library |
| Progress bar (focused) | `←` / `→` | Seek −5 s / +5 s |
| Video card | `Enter` / `Space` | Open |
| Chapter list | `Enter` / `Space` | Seek to chapter |
| Any modal | `Escape` | Close |

## Testing

End-to-end tests are in `tests/` and use [Playwright](https://playwright.dev), connected to the running app via Chrome DevTools Protocol (CDP). No browser driver is needed beyond what Playwright ships with.

**Prerequisites**

1. Build the debug binary first (only needed once after Rust changes):
   ```bash
   cd src-tauri
   cargo build
   ```
2. Install test dependencies (only needed once):
   ```bash
   cd tests
   npm install
   ```

**Run the tests**

```bash
cd tests
npm test
```

The test runner:
- Kills any existing app instance
- Launches `src-tauri/target/debug/app.exe` with the CDP debug port exposed
- Runs all specs sequentially against the live app
- Kills the app when done

To open Playwright's interactive UI (useful when writing new tests):

```bash
cd tests
npm run test:ui
```

**Test coverage**

| Suite | What it covers |
|---|---|
| `home.spec.js` | Video grid renders, category filter pills work |
| `player.spec.js` | Card click opens player or toast; back button returns home |
| `theme.spec.js` | Dark/light toggle, localStorage persistence |
| `admin.spec.js` | Admin modal opens/closes; setup and login forms both work; Enter key submits forms |

## Building the Windows installer

```bash
cd src-tauri
cargo tauri build
```

Output: `src-tauri/target/release/bundle/nsis/Oscahs Training_<version>_x64-setup.exe`

## Development workflow

There are two GitHub Actions workflows. Understanding the difference between them is the key to the whole pipeline:

| What you do | Workflow that runs | What it produces | Triggers staff auto-updates? |
|---|---|---|---|
| `git push` to `main` | `Build Windows Installer` | Downloadable NSIS installer artifact in Actions (expires after 30 days) | **No** |
| `git tag vX.Y.Z && git push origin vX.Y.Z` | `Release` | Signed GitHub Release + `latest.json` | **Yes** |

This gives you an implicit staging step: push your changes, download the artifact from the Actions run, install it on a test machine, and verify it before tagging. Only the tag triggers the release that auto-updates all staff.

### Day-to-day change cycle

1. Make and test changes locally:
   ```bash
   cd src-tauri
   cargo tauri dev
   ```
2. Run the test suite to catch regressions:
   ```bash
   cd tests && npm test
   ```
3. Push to `main` for a test build:
   ```bash
   git add <files>
   git commit -m "..."
   git push
   ```
4. Go to **Actions → Build Windows Installer → latest run** and download the installer artifact. Install it on a test machine and verify.
5. When happy, bump `version` in `src-tauri/tauri.conf.json` (e.g. `0.1.0` → `0.2.0`), commit, then tag and push:
   ```bash
   git add src-tauri/tauri.conf.json
   git commit -m "Release v0.2.0"
   git push
   git tag v0.2.0
   git push origin v0.2.0
   ```
6. The `Release` workflow builds, signs, and publishes a GitHub Release with the installer and update manifest. Every installed copy of the app checks on next launch and auto-updates — no manual reinstall needed.

### Required repository secrets

Set these under **Settings → Secrets and variables → Actions** before the `Release` workflow can sign and publish:

- `TAURI_SIGNING_PRIVATE_KEY` — the updater's Ed25519 private key (generated with `cargo tauri signer generate`)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password

## Project structure

```
ui/                              Frontend (HTML/CSS/JS, no build step)
  index.html                       Library grid, player, admin panel, updater UI
  oscahs-logo.svg / oscahs-logo-white.svg
  fonts/                           Solomon Sans webfonts
src-tauri/
  src/lib.rs                       Tauri shell: window, updater, process plugins only
  tauri.conf.json                  App + updater config
  capabilities/default.json        Permission grants (core, updater, process)
worker/                          Cloudflare Worker backend (videos, metadata, admin auth)
.github/workflows/
  build-windows.yml                Builds an installer artifact on every push to main
  release.yml                      Builds, signs, and publishes a GitHub Release on version tags
tests/
  playwright.config.js             Playwright config (sequential, single app instance)
  global-setup.js                  Launches the debug binary with CDP enabled
  global-teardown.js               Kills the app after the run
  fixtures.js                      Shared page fixture via connectOverCDP
  specs/                           Test suites (home, player, theme, admin)
```

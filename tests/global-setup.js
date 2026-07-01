const { spawn, execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '.pid');
const CDP_URL  = 'http://localhost:9222';
const APP_BIN  = path.join(__dirname, '..', 'src-tauri', 'target', 'debug', 'app.exe');

module.exports = async function globalSetup() {
  // Kill any leftover instance from a previous run
  try { execSync('taskkill /IM app.exe /F', { stdio: 'ignore' }); } catch {}

  const proc = spawn(APP_BIN, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222',
    },
    stdio: 'ignore',
    detached: false,
  });

  fs.writeFileSync(PID_FILE, String(proc.pid));

  // Wait until the CDP endpoint responds (up to 15 s)
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`${CDP_URL}/json/version`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Timed out waiting for app CDP endpoint at ' + CDP_URL);
};

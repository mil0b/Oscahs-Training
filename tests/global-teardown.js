const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '.pid');

module.exports = async function globalTeardown() {
  try {
    const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    fs.unlinkSync(PID_FILE);
  } catch {}
};

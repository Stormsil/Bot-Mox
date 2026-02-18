// Run Playwright smoke checks against the prod-like stack (Caddy) on http://localhost/
// without starting a dev webServer.

const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const botMoxDir = path.join(rootDir, 'bot-mox');

const env = {
  ...process.env,
  E2E_BASE_URL: process.env.E2E_BASE_URL || 'http://localhost',
  E2E_NO_WEB_SERVER: process.env.E2E_NO_WEB_SERVER || '1',
};

function spawnPlaywright() {
  // Node 24+ on Windows can fail spawning .cmd directly (EINVAL); use cmd.exe explicitly.
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const cmdline = 'npx playwright test';
    return spawn(comspec, ['/d', '/s', '/c', cmdline], { cwd: botMoxDir, env, stdio: 'inherit' });
  }

  return spawn('npx', ['playwright', 'test'], { cwd: botMoxDir, env, stdio: 'inherit' });
}

const child = spawnPlaywright();

child.on('exit', (code) => process.exit(code ?? 0));

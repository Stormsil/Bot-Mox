/**
 * Development Startup Script
 * Запускает Nest backend и Vite dev server параллельно
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logPrefix(prefix, message, color = 'reset') {
  console.log(`${colors[color]}[${prefix}]${colors.reset} ${message}`);
}

// Track child processes
const processes = [];
let isShuttingDown = false;

function parseDotEnvFile(raw) {
  const out = {};

  String(raw || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const eq = trimmed.indexOf('=');
      if (eq < 0) return;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (!key) return;

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      out[key] = value;
    });

  return out;
}

function resolveBackendPort() {
  const explicitPort = process.env.BOTMOX_BACKEND_PORT;
  const override = Number.parseInt(String(explicitPort || '').trim(), 10);
  if (Number.isFinite(override) && override > 0) {
    return override;
  }

  const backendPath = path.join(__dirname, 'apps', 'backend');
  const envPath = path.join(backendPath, '.env');
  const envExamplePath = path.join(backendPath, '.env.example');

  try {
    const raw = fs.existsSync(envPath)
      ? fs.readFileSync(envPath, 'utf8')
      : fs.existsSync(envExamplePath)
        ? fs.readFileSync(envExamplePath, 'utf8')
        : '';

    const parsed = parseDotEnvFile(raw);
    const port = Number.parseInt(String(parsed.NEST_PORT || parsed.PORT || '').trim(), 10);
    return Number.isFinite(port) ? port : 3002;
  } catch {
    return 3002;
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

/**
 * Spawn a process and handle its output
 * @param {string} name - Process name for logging
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 */
function spawnProcess(name, command, args, options = {}) {
  const colorMap = {
    BACKEND: 'cyan',
    VITE: 'green',
  };
  const color = colorMap[name] || 'reset';

  let launchCommand = command;
  let launchArgs = args;

  if (process.platform === 'win32') {
    launchCommand = process.env.ComSpec || 'cmd.exe';
    launchArgs = ['/d', '/s', '/c', [command, ...args].join(' ')];
  }

  logPrefix(name, `Starting ${command} ${args.join(' ')}...`, color);

  const proc = spawn(launchCommand, launchArgs, {
    stdio: 'pipe',
    shell: false,
    ...options,
  });

  processes.push({ name, proc });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        logPrefix(name, line, color);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line.trim()) {
        logPrefix(name, line, 'yellow');
      }
    });
  });

  proc.on('close', (code) => {
    logPrefix(name, `Process exited with code ${code}`, code === 0 ? 'green' : 'red');
    // Remove from processes array
    const index = processes.findIndex((p) => p.proc === proc);
    if (index > -1) {
      processes.splice(index, 1);
    }
    // If one process exits, kill all others
    if (code !== null) {
      shutdown(code === 0 ? 0 : 1);
    }
  });

  proc.on('error', (err) => {
    logPrefix(name, `Failed to start: ${err.message}`, 'red');
    shutdown(1);
  });

  return proc;
}

/**
 * Shutdown all processes gracefully
 */
function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  log('\n🛑 Shutting down all processes...', 'yellow');

  processes.forEach(({ name, proc }) => {
    logPrefix(name, 'Stopping...', 'yellow');
    try {
      // On Windows, we need to kill the process tree
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', proc.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        proc.kill('SIGTERM');
      }
    } catch (_e) {
      // Ignore errors during shutdown
    }
  });

  // Force exit after a short delay
  setTimeout(() => {
    log('👋 Goodbye!', 'green');
    process.exit(exitCode);
  }, 1000);
}

// Handle process signals
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

// Main execution
async function main() {
  log('╔════════════════════════════════════════════════════════════╗', 'bright');
  log('║     Bot-Mox Development Environment Startup               ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝', 'bright');
  log('');

  const backendPort = resolveBackendPort();
  const backendPortAvailable = await isPortAvailable(backendPort);
  if (!backendPortAvailable) {
    log(
      `❌ Port ${backendPort} is already in use. Stop the running process or change NEST_PORT in apps/backend/.env.`,
      'red',
    );
    log(
      `   Tip: check owner with \`Get-NetTCPConnection -LocalPort ${backendPort} -State Listen\``,
      'yellow',
    );
    process.exit(1);
    return;
  }

  // Start backend first
  const backendPath = path.join(__dirname, 'apps', 'backend');
  spawnProcess('BACKEND', 'corepack', ['pnpm', 'run', 'dev'], {
    cwd: backendPath,
    env: {
      ...process.env,
      PORT: String(backendPort),
      NEST_PORT: String(backendPort),
    },
  });

  // Wait a bit for backend to initialize
  log('');
  log('⏳ Waiting for backend to initialize...', 'dim');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (isShuttingDown) {
    return;
  }

  // Start Vite dev server
  const botMoxPath = path.join(__dirname, 'apps', 'frontend');
  spawnProcess('VITE', 'corepack', ['pnpm', 'run', 'dev'], {
    cwd: botMoxPath,
  });

  log('');
  log('✅ All services started!', 'green');
  log('');
  log('📱 Available endpoints:', 'bright');
  log(`   • Backend:      http://localhost:${backendPort}`, 'cyan');
  log('   • Vite Dev:     http://localhost:5173', 'green');
  log('');
  log('Press Ctrl+C to stop all services', 'dim');
  log('');
}

main().catch((err) => {
  log(`❌ Error: ${err.message}`, 'red');
  shutdown(1);
});

/**
 * Development Startup Script
 * Запускает proxy-server и Vite dev server параллельно
 */

const { spawn } = require('child_process');
const path = require('path');

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
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logPrefix(prefix, message, color = 'reset') {
  console.log(`${colors[color]}[${prefix}]${colors.reset} ${message}`);
}

// Track child processes
const processes = [];

/**
 * Spawn a process and handle its output
 * @param {string} name - Process name for logging
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 */
function spawnProcess(name, command, args, options = {}) {
  const colorMap = {
    'PROXY': 'cyan',
    'VITE': 'green'
  };
  const color = colorMap[name] || 'reset';

  logPrefix(name, `Starting ${command} ${args.join(' ')}...`, color);

  const proc = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    ...options
  });

  processes.push({ name, proc });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        logPrefix(name, line, color);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        logPrefix(name, line, 'yellow');
      }
    });
  });

  proc.on('close', (code) => {
    logPrefix(name, `Process exited with code ${code}`, code === 0 ? 'green' : 'red');
    // Remove from processes array
    const index = processes.findIndex(p => p.proc === proc);
    if (index > -1) {
      processes.splice(index, 1);
    }
    // If one process exits, kill all others
    if (code !== null) {
      shutdown();
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
    } catch (e) {
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
process.on('exit', () => shutdown());

// Main execution
async function main() {
  log('╔════════════════════════════════════════════════════════════╗', 'bright');
  log('║     Bot-Mox Development Environment Startup               ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝', 'bright');
  log('');

  // Start proxy server first
  const proxyPath = path.join(__dirname, 'proxy-server');
  spawnProcess('PROXY', 'npm', ['start'], {
    cwd: proxyPath
  });

  // Wait a bit for proxy server to initialize
  log('');
  log('⏳ Waiting for proxy server to initialize...', 'dim');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start Vite dev server
  const botMoxPath = path.join(__dirname, 'bot-mox');
  spawnProcess('VITE', 'npm', ['run', 'dev'], {
    cwd: botMoxPath
  });

  log('');
  log('✅ All services started!', 'green');
  log('');
  log('📱 Available endpoints:', 'bright');
  log('   • Proxy Server: http://localhost:3001', 'cyan');
  log('   • Vite Dev:     http://localhost:5173', 'green');
  log('');
  log('Press Ctrl+C to stop all services', 'dim');
  log('');
}

main().catch(err => {
  log(`❌ Error: ${err.message}`, 'red');
  shutdown(1);
});

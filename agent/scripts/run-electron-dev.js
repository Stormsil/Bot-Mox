#!/usr/bin/env node

const { spawn } = require('node:child_process');

function main() {
  const electronBinary = require('electron');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electronBinary, ['.'], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(typeof code === 'number' ? code : 0);
  });

  child.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to launch Electron:', error);
    process.exit(1);
  });
}

main();


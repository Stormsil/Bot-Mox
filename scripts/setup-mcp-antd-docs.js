#!/usr/bin/env node
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function main() {
  const repoRoot = process.cwd();
  const extractorPath = path.join(
    repoRoot,
    'node_modules',
    'mcp-antd-components',
    'scripts',
    'extract-docs.mjs',
  );
  if (!fs.existsSync(extractorPath)) {
    throw new Error(
      'Missing extractor script. Install dependencies first: corepack pnpm install --frozen-lockfile',
    );
  }

  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'botmox-antd-docs-'));
  const antdRepoDir = path.join(tempRoot, 'ant-design');

  try {
    await runCommand('git', [
      'clone',
      '--depth',
      '1',
      'https://github.com/ant-design/ant-design.git',
      antdRepoDir,
    ]);
    await runCommand(process.execPath, [extractorPath, antdRepoDir], { cwd: repoRoot });
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});

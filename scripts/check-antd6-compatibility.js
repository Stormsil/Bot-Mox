#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function extractMajor(versionRange) {
  const match = String(versionRange || '').match(/(\d+)(?:\.\d+)?(?:\.\d+)?/);
  return match ? Number(match[1]) : null;
}

function supportsMajor(versionRange, major) {
  const range = String(versionRange || '');
  return new RegExp(`(^|\\D)${major}(?:\\.\\d+)?(?:\\.\\d+)?(\\D|$)`).test(range);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const webPackagePath = path.join(process.cwd(), 'bot-mox', 'package.json');
if (!fs.existsSync(webPackagePath)) {
  process.stderr.write('Missing bot-mox/package.json. Run from repository root.\n');
  process.exit(1);
}

const webPackage = readJson(webPackagePath);
const webDependencies = {
  ...(webPackage.dependencies || {}),
  ...(webPackage.devDependencies || {}),
};

const localAntdRange = webDependencies.antd || null;
const localRefineAntdRange = webDependencies['@refinedev/antd'] || null;
const localReactRange = webDependencies.react || null;

let registryMeta;
try {
  const registryJson = execSync(
    'corepack pnpm view @refinedev/antd version peerDependencies --json',
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  registryMeta = JSON.parse(registryJson);
} catch (error) {
  process.stderr.write('Unable to read/parse @refinedev/antd metadata from registry.\n');
  process.stderr.write(String(error));
  process.stderr.write('\n');
  process.exit(1);
}

const refineVersion = registryMeta?.version || 'unknown';
const refineAntdPeerRange = registryMeta?.peerDependencies?.antd || '';
const refineReactPeerRange = registryMeta?.peerDependencies?.react || '';

const localAntdMajor = extractMajor(localAntdRange);
const localReactMajor = extractMajor(localReactRange);

const refineSupportsAntd6 = supportsMajor(refineAntdPeerRange, 6);
const localUsesAntd6 = localAntdMajor === 6;
const localUsesReact19 = localReactMajor === 19;

process.stdout.write('AntD 6 compatibility gate report\n');
process.stdout.write('================================\n');
process.stdout.write(`Web app antd range: ${localAntdRange || 'N/A'}\n`);
process.stdout.write(`Web app @refinedev/antd range: ${localRefineAntdRange || 'N/A'}\n`);
process.stdout.write(`Web app react range: ${localReactRange || 'N/A'}\n`);
process.stdout.write(`Registry @refinedev/antd version: ${refineVersion}\n`);
process.stdout.write(`Registry @refinedev/antd peer antd: ${refineAntdPeerRange || 'N/A'}\n`);
process.stdout.write(`Registry @refinedev/antd peer react: ${refineReactPeerRange || 'N/A'}\n`);
process.stdout.write(
  `Gate check: refine peer supports antd@6 -> ${refineSupportsAntd6 ? 'yes' : 'no'}\n`,
);
process.stdout.write(`Gate check: local uses antd@6 -> ${localUsesAntd6 ? 'yes' : 'no'}\n`);
process.stdout.write(`Gate check: local uses react@19 -> ${localUsesReact19 ? 'yes' : 'no'}\n`);

if (!refineSupportsAntd6) {
  process.stderr.write(
    '\nAntD 6 migration gate is BLOCKED: current @refinedev/antd peer range does not include antd@6.\n',
  );
  process.exit(2);
}

process.stdout.write('\nAntD 6 migration gate is OPEN for pilot migration.\n');

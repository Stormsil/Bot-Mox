#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

function listFilesRecursively(dirPath, predicate) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath, predicate));
      continue;
    }
    if (entry.isFile() && predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function hasNestBoundaryDecorators(text) {
  return /@Body\s*\(|@Param\s*\(|@Query\s*\(/.test(text);
}

function hasNestValidation(text) {
  return /safeParse\s*\(|\.parse\s*\(/.test(text);
}

function checkNestControllers() {
  const modulesDir = path.join(repoRoot, 'apps', 'backend', 'src', 'modules');
  const files = listFilesRecursively(modulesDir, (filePath) => filePath.endsWith('controller.ts'));
  const violations = [];
  let checked = 0;

  for (const filePath of files) {
    const text = readText(filePath);
    if (!hasNestBoundaryDecorators(text)) {
      continue;
    }
    checked += 1;
    if (!hasNestValidation(text)) {
      violations.push(
        `${relative(filePath)}: uses @Body/@Param/@Query without detected Zod parsing`,
      );
    }
  }

  return { checked, violations };
}

function checkAgentBoundaries() {
  const checks = [
    {
      file: path.join(repoRoot, 'apps', 'agent', 'src', 'core', 'api-client.ts'),
      pattern: /apiEnvelopeSchema\.safeParse\s*\(/,
      message: 'expected apiEnvelopeSchema.safeParse(...) for API envelope validation',
    },
    {
      file: path.join(repoRoot, 'apps', 'agent', 'src', 'core', 'agent-loop.ts'),
      pattern: /queuedCommandSchema\.safeParse\s*\(/,
      message: 'expected queuedCommandSchema.safeParse(...) for command payload boundary',
    },
  ];

  const violations = [];
  let checked = 0;

  for (const item of checks) {
    if (!fs.existsSync(item.file)) {
      violations.push(`${relative(item.file)}: file missing`);
      continue;
    }
    checked += 1;
    const text = readText(item.file);
    if (!item.pattern.test(text)) {
      violations.push(`${relative(item.file)}: ${item.message}`);
    }
  }

  return { checked, violations };
}

function main() {
  const nest = checkNestControllers();
  const agent = checkAgentBoundaries();

  const violations = [...nest.violations, ...agent.violations];
  const totalChecked = nest.checked + agent.checked;

  process.stdout.write('Zod boundary gate report\n');
  process.stdout.write('========================\n');
  process.stdout.write(`Nest controllers checked: ${nest.checked}\n`);
  process.stdout.write(`Agent boundary files checked: ${agent.checked}\n`);
  process.stdout.write(`Total checked: ${totalChecked}\n`);
  process.stdout.write(`Violations: ${violations.length}\n`);

  if (violations.length > 0) {
    process.stderr.write('\nDetected missing Zod boundary validations:\n');
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`);
    }
    process.exit(2);
  }

  process.stdout.write('All checked boundaries include Zod validation patterns.\n');
}

main();

#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const frontendRoot = path.join(repoRoot, 'apps', 'frontend', 'src');
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

const forbiddenPatterns = [
  {
    id: 'admin-api-route',
    pattern: /\/api\/v1\/admin(?:\/|['"`])/g,
    message: 'Direct admin API usage is forbidden in main frontend.',
  },
  {
    id: 'auth-admin-api-route',
    pattern: /\/api\/v1\/auth\/admin(?:\/|['"`])/g,
    message: 'Admin auth API usage is forbidden in main frontend.',
  },
  {
    id: 'billing-admin-api-route',
    pattern: /\/api\/v1\/billing\/admin(?:\/|['"`])/g,
    message: 'Admin billing API usage is forbidden in main frontend.',
  },
  {
    id: 'admin-token-storage-key',
    pattern: /botmox\.admin\.auth\./g,
    message: 'Admin token storage keys are forbidden in main frontend.',
  },
];

function walk(dir, acc) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    acc.push(fullPath);
  }
}

function lineFromIndex(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  for (const rule of forbiddenPatterns) {
    const matches = content.matchAll(rule.pattern);
    for (const match of matches) {
      const index = Number(match.index || 0);
      violations.push({
        ruleId: rule.id,
        message: rule.message,
        line: lineFromIndex(content, index),
        snippet: String(match[0] || '').trim(),
      });
    }
  }
  return violations;
}

const files = [];
walk(frontendRoot, files);

const violations = [];
for (const filePath of files) {
  const fileViolations = scanFile(filePath);
  for (const violation of fileViolations) {
    violations.push({
      file: path.relative(repoRoot, filePath),
      ...violation,
    });
  }
}

if (violations.length > 0) {
  console.error(
    '[check-admin-surface-isolation] Main frontend must stay isolated from admin surface.',
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} [${violation.ruleId}] ${violation.message} (match: ${violation.snippet})`,
    );
  }
  process.exit(1);
}

console.log(`[check-admin-surface-isolation] OK. Checked ${files.length} files; violations: 0.`);

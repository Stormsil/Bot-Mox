#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'bot-mox', 'src');
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const STRICT = process.argv.includes('--strict');

const RULES = [
  {
    id: 'visible-prop',
    description: 'Legacy `visible` prop on popup components (prefer `open`).',
    recommendation:
      'Replace `visible={...}` with `open={...}` for Modal/Drawer/Dropdown/Tooltip/Popover/Popconfirm.',
    regex: /<(?:Modal|Drawer|Dropdown|Tooltip|Popover|Popconfirm)\b[^>\n]*\bvisible\s*=\s*\{?/g,
  },
  {
    id: 'dropdown-overlay-prop',
    description: 'Legacy Dropdown `overlay` prop usage.',
    recommendation:
      'Prefer `menu={{ items }}` or `dropdownRender` depending on current Dropdown usage pattern.',
    regex: /<Dropdown\b[^>\n]*\boverlay\s*=\s*\{?/g,
  },
  {
    id: 'dropdown-class-name-prop',
    description: 'Legacy `dropdownClassName` prop usage.',
    recommendation:
      'Migrate to the modern popup class API (`popupClassName`) where supported by the component.',
    regex:
      /<(?:Select|TreeSelect|Cascader|DatePicker|TimePicker|AutoComplete)\b[^>\n]*\bdropdownClassName\s*=\s*\{?/g,
  },
];

function listFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function getLineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function scanFile(filePath, results) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let match = rule.regex.exec(text);
    while (match) {
      const lineNumber = getLineNumber(text, match.index);
      const excerpt = lines[lineNumber - 1] || '';
      results.push({
        ruleId: rule.id,
        description: rule.description,
        recommendation: rule.recommendation,
        file: relativePath,
        line: lineNumber,
        excerpt: excerpt.trim(),
      });
      match = rule.regex.exec(text);
    }
  }
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    process.stderr.write('Missing bot-mox/src directory. Run from repository root.\n');
    process.exit(1);
  }

  const files = listFiles(SOURCE_DIR);
  const findings = [];
  for (const filePath of files) {
    scanFile(filePath, findings);
  }

  process.stdout.write('AntD 6 API hotspot scan\n');
  process.stdout.write('======================\n');
  process.stdout.write(`Scanned files: ${files.length}\n`);
  process.stdout.write(`Findings: ${findings.length}\n`);

  if (findings.length === 0) {
    process.stdout.write('No AntD 6 migration hotspots detected by static rules.\n');
    return;
  }

  const byRule = new Map();
  for (const finding of findings) {
    if (!byRule.has(finding.ruleId)) {
      byRule.set(finding.ruleId, []);
    }
    byRule.get(finding.ruleId).push(finding);
  }

  for (const rule of RULES) {
    const matches = byRule.get(rule.id) || [];
    if (matches.length === 0) {
      continue;
    }
    process.stdout.write(`\n[${rule.id}] ${rule.description}\n`);
    process.stdout.write(`Recommendation: ${rule.recommendation}\n`);
    process.stdout.write(`Matches: ${matches.length}\n`);
    for (const match of matches.slice(0, 20)) {
      process.stdout.write(`- ${match.file}:${match.line} :: ${match.excerpt}\n`);
    }
    if (matches.length > 20) {
      process.stdout.write(`- ... and ${matches.length - 20} more matches\n`);
    }
  }

  if (STRICT) {
    process.stderr.write(
      '\nAntD 6 API hotspot strict gate failed: migrate flagged patterns before cutover.\n',
    );
    process.exit(2);
  }
}

main();

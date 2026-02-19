const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const uiRoots = [
  path.join(repoRoot, 'apps', 'frontend', 'src', 'components'),
  path.join(repoRoot, 'apps', 'frontend', 'src', 'pages'),
];

const fileExtensions = new Set(['.ts', '.tsx']);
const serviceImportPattern = /(?:^|[/\\])services[/\\]/;

function walk(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (!fileExtensions.has(path.extname(entry.name))) {
      continue;
    }

    files.push(fullPath);
  }
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function findViolations(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  const importPattern = /import\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [importPattern, dynamicImportPattern]) {
    let match = pattern.exec(content);
    while (match) {
      const importPath = match[1] || '';
      if (serviceImportPattern.test(importPath)) {
        violations.push({
          line: getLineNumber(content, match.index),
          importPath,
        });
      }

      match = pattern.exec(content);
    }
  }

  return violations;
}

const filesToCheck = [];
for (const root of uiRoots) {
  walk(root, filesToCheck);
}

const allViolations = [];
for (const filePath of filesToCheck) {
  const violations = findViolations(filePath);
  for (const violation of violations) {
    allViolations.push({
      filePath: path.relative(repoRoot, filePath),
      line: violation.line,
      importPath: violation.importPath,
    });
  }
}

if (allViolations.length > 0) {
  console.error(
    '[check-ui-boundaries] Direct services imports are forbidden in UI layers (components/pages).',
  );
  for (const violation of allViolations) {
    console.error(`- ${violation.filePath}:${violation.line} -> ${violation.importPath}`);
  }
  process.exit(1);
}

console.log(`[check-ui-boundaries] OK. Checked ${filesToCheck.length} UI files; violations: 0.`);

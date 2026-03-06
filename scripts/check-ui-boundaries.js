const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const serviceBoundaryRoots = [
  path.join(repoRoot, 'apps', 'frontend', 'src', 'app'),
  path.join(repoRoot, 'apps', 'frontend', 'src', 'pages'),
  path.join(repoRoot, 'apps', 'frontend', 'src', 'widgets'),
  path.join(repoRoot, 'apps', 'frontend', 'src', 'entities'),
];
const transportBoundaryRoots = [
  path.join(repoRoot, 'apps', 'frontend', 'src', 'pages'),
  path.join(repoRoot, 'apps', 'frontend', 'src', 'widgets'),
  path.join(repoRoot, 'apps', 'frontend', 'src', 'features'),
];

const fileExtensions = new Set(['.ts', '.tsx']);
const serviceImportPattern = /(?:^|[/\\])services[/\\]/;
const forbiddenTransportImportPatterns = [
  /(?:^|[/\\])shared[/\\]api[/\\]apiClient(?:$|\b|[/\\])/,
  /(?:^|[/\\])shared[/\\]api[/\\]providers(?:$|[/\\])/,
];
const forbiddenHeavyDatasetImportPatterns = [
  /(?:^|[/\\])shared[/\\]config[/\\]data[/\\]windows-bloatware\.json$/,
  /(?:^|[/\\])shared[/\\]config[/\\]data[/\\]windows-geolocations\.json$/,
  /(?:^|[/\\])shared[/\\]config[/\\]data[/\\]windows-keyboards\.json$/,
  /(?:^|[/\\])shared[/\\]config[/\\]data[/\\]windows-languages\.json$/,
  /(?:^|[/\\])shared[/\\]config[/\\]data[/\\]windows-timezones\.json$/,
];

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
  const importMetaUrlPattern = /new\s+URL\s*\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g;

  function pushPathViolations(importPath, line) {
    if (serviceImportPattern.test(importPath)) {
      violations.push({
        line,
        importPath,
        category: 'service',
      });
    }

    if (forbiddenTransportImportPatterns.some((pattern) => pattern.test(importPath))) {
      violations.push({
        line,
        importPath,
        category: 'transport',
      });
    }

    if (forbiddenHeavyDatasetImportPatterns.some((pattern) => pattern.test(importPath))) {
      violations.push({
        line,
        importPath,
        category: 'heavy-dataset',
      });
    }
  }

  for (const pattern of [importPattern, dynamicImportPattern]) {
    let match = pattern.exec(content);
    while (match) {
      const importPath = match[1] || '';
      pushPathViolations(importPath, getLineNumber(content, match.index));

      match = pattern.exec(content);
    }
  }

  let importMetaUrlMatch = importMetaUrlPattern.exec(content);
  while (importMetaUrlMatch) {
    const importPath = importMetaUrlMatch[2] || '';
    const line = getLineNumber(content, importMetaUrlMatch.index);
    if (forbiddenHeavyDatasetImportPatterns.some((pattern) => pattern.test(importPath))) {
      violations.push({
        line,
        importPath,
        category: 'heavy-dataset',
      });
    }

    importMetaUrlMatch = importMetaUrlPattern.exec(content);
  }

  return violations;
}

const missingRoots = [...serviceBoundaryRoots, ...transportBoundaryRoots].filter(
  (root, index, all) => all.indexOf(root) === index && !fs.existsSync(root),
);
if (missingRoots.length > 0) {
  console.error(
    '[check-ui-boundaries] stale/missing UI roots detected; refusing false-green result.',
  );
  for (const root of missingRoots) {
    console.error(`- missing root: ${path.relative(repoRoot, root)}`);
  }
  process.exit(1);
}

const serviceBoundaryFiles = [];
for (const root of serviceBoundaryRoots) {
  walk(root, serviceBoundaryFiles);
}

const transportBoundaryFiles = [];
for (const root of transportBoundaryRoots) {
  walk(root, transportBoundaryFiles);
}

if (serviceBoundaryFiles.length === 0) {
  console.error(
    '[check-ui-boundaries] zero service-boundary files scanned; refusing false-green result.',
  );
  process.exit(1);
}

if (transportBoundaryFiles.length === 0) {
  console.error(
    '[check-ui-boundaries] zero transport-boundary files scanned; refusing false-green result.',
  );
  process.exit(1);
}

const allViolations = [];
for (const filePath of serviceBoundaryFiles) {
  const violations = findViolations(filePath).filter(
    (violation) => violation.category === 'service',
  );
  for (const violation of violations) {
    allViolations.push({
      filePath: path.relative(repoRoot, filePath),
      line: violation.line,
      importPath: violation.importPath,
      category: violation.category,
    });
  }
}

for (const filePath of transportBoundaryFiles) {
  const violations = findViolations(filePath).filter(
    (violation) => violation.category === 'transport',
  );
  for (const violation of violations) {
    allViolations.push({
      filePath: path.relative(repoRoot, filePath),
      line: violation.line,
      importPath: violation.importPath,
      category: violation.category,
    });
  }
}

const heavyDatasetBoundaryFiles = Array.from(
  new Set([...serviceBoundaryFiles, ...transportBoundaryFiles]),
);
for (const filePath of heavyDatasetBoundaryFiles) {
  const violations = findViolations(filePath).filter(
    (violation) => violation.category === 'heavy-dataset',
  );
  for (const violation of violations) {
    allViolations.push({
      filePath: path.relative(repoRoot, filePath),
      line: violation.line,
      importPath: violation.importPath,
      category: violation.category,
    });
  }
}

if (allViolations.length > 0) {
  console.error('[check-ui-boundaries] Forbidden UI boundary imports detected.');
  for (const violation of allViolations) {
    console.error(
      `- [${violation.category}] ${violation.filePath}:${violation.line} -> ${violation.importPath}`,
    );
  }
  process.exit(1);
}

const scannedFiles = serviceBoundaryFiles.length + transportBoundaryFiles.length;
console.log(
  `[check-ui-boundaries] OK. Checked ${scannedFiles} UI files (service: ${serviceBoundaryFiles.length}, transport: ${transportBoundaryFiles.length}); violations: 0.`,
);

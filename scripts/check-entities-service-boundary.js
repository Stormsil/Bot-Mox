#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = process.cwd();
const entitiesRoot = path.join(repoRoot, 'bot-mox', 'src', 'entities');
const baselineFile = path.join(repoRoot, 'configs', 'entities-service-import-baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');

const sourceExtensions = new Set(['.ts', '.tsx']);
function toUnixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function listSourceFiles(dir) {
  const result = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (sourceExtensions.has(path.extname(entry.name))) {
        result.push(absolutePath);
      }
    }
  }
  return result.sort();
}

function collectImports() {
  const imports = [];
  const files = listSourceFiles(entitiesRoot);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    for (const statement of sourceFile.statements) {
      let moduleLiteral = null;
      if (ts.isImportDeclaration(statement) && statement.moduleSpecifier) {
        moduleLiteral = statement.moduleSpecifier;
      } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
        moduleLiteral = statement.moduleSpecifier;
      }

      if (!moduleLiteral || !ts.isStringLiteral(moduleLiteral)) {
        continue;
      }

      const specifier = moduleLiteral.text;
      if (!specifier.includes('services/')) {
        continue;
      }

      const line =
        sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
      imports.push({
        file: toUnixPath(path.relative(repoRoot, filePath)),
        line,
        specifier,
      });
    }
  }

  return imports.sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) return fileCompare;
    const specCompare = a.specifier.localeCompare(b.specifier);
    if (specCompare !== 0) return specCompare;
    return a.line - b.line;
  });
}

function readBaseline() {
  if (!fs.existsSync(baselineFile)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const allowed = Array.isArray(parsed?.allowed) ? parsed.allowed : [];
  return new Set(allowed.map((entry) => `${entry.file}|${entry.specifier}`));
}

function ensureBaselineDir() {
  const baselineDir = path.dirname(baselineFile);
  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }
}

const imports = collectImports();
const compact = imports.map((entry) => ({
  file: entry.file,
  specifier: entry.specifier,
}));
const uniqueCompact = Array.from(
  new Map(compact.map((entry) => [`${entry.file}|${entry.specifier}`, entry])).values(),
).sort((a, b) => {
  const fileCompare = a.file.localeCompare(b.file);
  if (fileCompare !== 0) return fileCompare;
  return a.specifier.localeCompare(b.specifier);
});

if (writeBaseline) {
  ensureBaselineDir();
  const payload = {
    generatedAt: new Date().toISOString(),
    description:
      'Temporary allowlist for legacy services imports inside entities; new imports are blocked by check script.',
    allowed: uniqueCompact,
  };
  fs.writeFileSync(baselineFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `[check-entities-service-boundary] baseline updated: ${toUnixPath(path.relative(repoRoot, baselineFile))} (${uniqueCompact.length} entries)\n`,
  );
  process.exit(0);
}

const baseline = readBaseline();
if (!baseline) {
  process.stderr.write(
    `[check-entities-service-boundary] missing baseline file: ${toUnixPath(path.relative(repoRoot, baselineFile))}\n`,
  );
  process.stderr.write(
    '[check-entities-service-boundary] run `node scripts/check-entities-service-boundary.js --write-baseline`\n',
  );
  process.exit(1);
}

const violations = imports.filter((entry) => !baseline.has(`${entry.file}|${entry.specifier}`));

if (violations.length > 0) {
  process.stderr.write(
    `[check-entities-service-boundary] found ${violations.length} new legacy service import(s) in entities:\n`,
  );
  for (const entry of violations) {
    process.stderr.write(` - ${entry.file}:${entry.line} -> ${entry.specifier}\n`);
  }
  process.stderr.write(
    '[check-entities-service-boundary] migrate import to entities/providers contract layer or explicitly update baseline after approved refactor wave.\n',
  );
  process.exit(2);
}

process.stdout.write(
  `[check-entities-service-boundary] OK. checked ${imports.length} imports; new violations: 0.\n`,
);

#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = process.cwd();
const modulesRoot = path.join(repoRoot, 'apps', 'backend', 'src', 'modules');

const SOURCE_EXTENSIONS = new Set(['.ts']);
const TEST_FILE_PATTERNS = [/\.test\.ts$/i, /\.spec\.ts$/i];
const SHARED_DOMAIN_ALLOWLIST = new Set(['auth', 'common', 'db', 'observability']);

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isTestFile(filePath) {
  const normalized = toPosix(filePath);
  if (normalized.includes('/__tests__/')) {
    return true;
  }
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const result = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        continue;
      }
      if (entry.name.endsWith('.d.ts')) {
        continue;
      }
      if (isTestFile(fullPath)) {
        continue;
      }
      result.push(fullPath);
    }
  }

  return result.sort();
}

function getDomainFromAbsolutePath(targetPath) {
  const relativeToModules = path.relative(modulesRoot, targetPath);
  if (
    !relativeToModules ||
    relativeToModules.startsWith('..') ||
    path.isAbsolute(relativeToModules)
  ) {
    return null;
  }

  const segments = toPosix(relativeToModules).split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const first = segments[0];
  if (!first || first.includes('.')) {
    return null;
  }

  return first;
}

function getTargetDomain(specifier, sourceFilePath) {
  const normalizedSpecifier = String(specifier || '').trim();
  if (!normalizedSpecifier) {
    return null;
  }

  if (normalizedSpecifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(sourceFilePath), normalizedSpecifier);
    return getDomainFromAbsolutePath(resolved);
  }

  const absolutePrefixes = ['apps/backend/src/modules/', 'src/modules/', '/src/modules/'];
  for (const prefix of absolutePrefixes) {
    if (!normalizedSpecifier.startsWith(prefix)) {
      continue;
    }

    const tail = normalizedSpecifier.slice(prefix.length);
    const domain = tail.split('/').filter(Boolean)[0];
    return domain || null;
  }

  return null;
}

function collectViolations(files) {
  const violations = [];

  for (const filePath of files) {
    const sourceDomain = getDomainFromAbsolutePath(filePath);
    if (!sourceDomain) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
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
      const targetDomain = getTargetDomain(specifier, filePath);
      if (!targetDomain) {
        continue;
      }
      if (targetDomain === sourceDomain) {
        continue;
      }
      if (SHARED_DOMAIN_ALLOWLIST.has(targetDomain)) {
        continue;
      }

      const line =
        sourceFile.getLineAndCharacterOfPosition(moduleLiteral.getStart(sourceFile)).line + 1;
      violations.push({
        file: toPosix(path.relative(repoRoot, filePath)),
        line,
        sourceDomain,
        targetDomain,
        specifier,
      });
    }
  }

  return violations.sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) {
      return fileCompare;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.specifier.localeCompare(b.specifier);
  });
}

if (!fs.existsSync(modulesRoot)) {
  process.stderr.write(
    '[check-backend-domain-boundaries] backend modules root was not found: apps/backend/src/modules\n',
  );
  process.exit(1);
}

const targetFiles = listSourceFiles(modulesRoot);
if (targetFiles.length === 0) {
  process.stderr.write(
    '[check-backend-domain-boundaries] no target backend module files found; refusing false-green result.\n',
  );
  process.exit(1);
}

const violations = collectViolations(targetFiles);
if (violations.length > 0) {
  process.stderr.write(
    `[check-backend-domain-boundaries] found ${violations.length} forbidden backend cross-domain import(s).\n`,
  );
  process.stderr.write(
    '[check-backend-domain-boundaries] allowed cross-domain targets: auth, common, db, observability\n',
  );
  for (const violation of violations) {
    process.stderr.write(
      ` - ${violation.file}:${violation.line} ${violation.sourceDomain} -> ${violation.targetDomain} via ${JSON.stringify(violation.specifier)}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(
  `[check-backend-domain-boundaries] OK. scanned ${targetFiles.length} backend module files; violations: 0.\n`,
);

#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = process.cwd();
const providersRoot = path.join(repoRoot, 'apps', 'frontend', 'src', 'app', 'providers');

const sourceExtensions = new Set(['.ts', '.tsx']);

const forbiddenSpecifiers = [
  '/services/vmService',
  '/services/vmSettingsService',
  '/services/unattendProfileService',
  '/services/secretsService',
  '/services/vmOpsEventsService',
  '/shared/lib/vm/',
];

function toUnixPath(filePath) {
  return filePath.replace(/\\/g, '/');
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

function isForbidden(specifier) {
  return forbiddenSpecifiers.some((entry) => specifier.includes(entry));
}

function collectViolations() {
  const violations = [];
  if (!fs.existsSync(providersRoot)) {
    process.stderr.write(
      '[check-vm-provider-boundary] stale/missing providers root: apps/frontend/src/app/providers\n',
    );
    process.exit(1);
  }

  if (forbiddenSpecifiers.length === 0) {
    process.stderr.write(
      '[check-vm-provider-boundary] forbidden specifier list is empty; refusing false-green result.\n',
    );
    process.exit(1);
  }

  const files = listSourceFiles(providersRoot);
  if (files.length === 0) {
    process.stderr.write(
      '[check-vm-provider-boundary] zero provider target files scanned; refusing false-green result.\n',
    );
    process.exit(1);
  }

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
      if (!isForbidden(specifier)) {
        continue;
      }

      const line =
        sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
      violations.push({
        file: toUnixPath(path.relative(repoRoot, filePath)),
        line,
        specifier,
      });
    }
  }

  return {
    scannedFiles: files.length,
    violations: violations.sort((a, b) => {
      const fileCompare = a.file.localeCompare(b.file);
      if (fileCompare !== 0) {
        return fileCompare;
      }

      const specCompare = a.specifier.localeCompare(b.specifier);
      if (specCompare !== 0) {
        return specCompare;
      }

      return a.line - b.line;
    }),
  };
}

const { scannedFiles, violations } = collectViolations();
if (violations.length > 0) {
  process.stderr.write(
    `[check-vm-provider-boundary] found ${violations.length} forbidden VM provider import(s):\n`,
  );
  for (const violation of violations) {
    process.stderr.write(` - ${violation.file}:${violation.line} -> ${violation.specifier}\n`);
  }
  process.stderr.write(
    '[check-vm-provider-boundary] migrate provider implementation to contract/path-client/runtime helpers instead of deprecated vm services/bridges.\n',
  );
  process.exit(2);
}

process.stdout.write(
  `[check-vm-provider-boundary] OK. scanned ${scannedFiles} provider files; no forbidden VM provider imports detected.\n`,
);

#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const fixtureMode = args.has('--fixture') || args.has('--fixture-mode');

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.turbo',
  'test-results',
  'playwright-report',
]);
const DEFAULT_ENTRY_MODULE_PATTERNS = [
  /\/index\.[cm]?[jt]sx?$/i,
  /\/main\.[cm]?[jt]sx?$/i,
  /\/bootstrap\.[cm]?[jt]sx?$/i,
];
const DEFAULT_IGNORE_MODULE_PATTERNS = [
  /\.d\.ts$/i,
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  /__tests__\//i,
  /\/fixtures\//i,
  /\/mocks?\//i,
];

const DEFAULT_DOMAINS = [
  {
    name: 'frontend',
    roots: ['apps/frontend/src'],
    thresholds: { deadCode: 20, orphanExports: 250, unusedModules: 20 },
  },
  {
    name: 'backend',
    roots: ['apps/backend/src'],
    thresholds: { deadCode: 20, orphanExports: 80, unusedModules: 10 },
  },
  {
    name: 'agent',
    roots: ['apps/agent/src'],
    thresholds: { deadCode: 10, orphanExports: 25, unusedModules: 10 },
  },
  {
    name: 'packages',
    roots: ['packages'],
    thresholds: { deadCode: 35, orphanExports: 300, unusedModules: 60 },
  },
];

const ENV_KEY_MAP = {
  deadCode: 'STRUCTURAL_HYGIENE_MAX_DEAD_CODE',
  orphanExports: 'STRUCTURAL_HYGIENE_MAX_ORPHAN_EXPORTS',
  unusedModules: 'STRUCTURAL_HYGIENE_MAX_UNUSED_MODULES',
};

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function normalizeModulePath(value) {
  return normalizePath(value).replace(/\.[cm]?[jt]sx?$/i, '');
}

function parseIntOrDefault(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    process.stderr.write(`[check-structural-hygiene] invalid JSON in ${name}; using fallback.\n`);
    return fallback;
  }
}

function readOptionalConfig() {
  const configFromEnv = process.env.STRUCTURAL_HYGIENE_CONFIG_PATH;
  const configPath = configFromEnv
    ? path.resolve(repoRoot, configFromEnv)
    : path.join(repoRoot, 'scripts', 'structural-hygiene.config.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_error) {
    process.stderr.write(
      `[check-structural-hygiene] warning: failed to parse ${normalizePath(path.relative(repoRoot, configPath))}; config ignored.\n`,
    );
    return null;
  }
}

function mergeThresholds(base, override) {
  const next = { ...base };
  for (const key of Object.keys(ENV_KEY_MAP)) {
    if (typeof override?.[key] === 'number' && override[key] >= 0) {
      next[key] = Math.floor(override[key]);
    }
  }
  return next;
}

function buildEffectiveConfig() {
  const optionalConfig = readOptionalConfig();
  const domainOverridesFromEnv = parseJsonEnv('STRUCTURAL_HYGIENE_DOMAIN_THRESHOLDS', {});
  const domainOverridesFromConfig = optionalConfig?.domainThresholds || {};
  const moduleThresholds = parseJsonEnv(
    'STRUCTURAL_HYGIENE_MODULE_THRESHOLDS',
    optionalConfig?.moduleThresholds || {},
  );
  const ignoreModules = new Set(
    [
      ...(optionalConfig?.ignoreModules || []),
      ...(parseJsonEnv('STRUCTURAL_HYGIENE_IGNORE_MODULES', []) || []),
    ].map(normalizePath),
  );
  const ignoreExportsByModule = parseJsonEnv(
    'STRUCTURAL_HYGIENE_IGNORE_EXPORTS',
    optionalConfig?.ignoreExportsByModule || {},
  );
  const ignoreDeadByModule = parseJsonEnv(
    'STRUCTURAL_HYGIENE_IGNORE_DEAD_CODE',
    optionalConfig?.ignoreDeadCodeByModule || {},
  );

  const domains = DEFAULT_DOMAINS.map((domain) => {
    const envPrefixed = {
      deadCode: parseIntOrDefault(
        process.env[`${ENV_KEY_MAP.deadCode}_${domain.name.toUpperCase()}`],
        domain.thresholds.deadCode,
      ),
      orphanExports: parseIntOrDefault(
        process.env[`${ENV_KEY_MAP.orphanExports}_${domain.name.toUpperCase()}`],
        domain.thresholds.orphanExports,
      ),
      unusedModules: parseIntOrDefault(
        process.env[`${ENV_KEY_MAP.unusedModules}_${domain.name.toUpperCase()}`],
        domain.thresholds.unusedModules,
      ),
    };

    const generic = {
      deadCode: parseIntOrDefault(process.env[ENV_KEY_MAP.deadCode], envPrefixed.deadCode),
      orphanExports: parseIntOrDefault(
        process.env[ENV_KEY_MAP.orphanExports],
        envPrefixed.orphanExports,
      ),
      unusedModules: parseIntOrDefault(
        process.env[ENV_KEY_MAP.unusedModules],
        envPrefixed.unusedModules,
      ),
    };

    const configOverride = domainOverridesFromConfig[domain.name] || {};
    const envOverride = domainOverridesFromEnv[domain.name] || {};
    const thresholds = mergeThresholds(mergeThresholds(generic, configOverride), envOverride);

    return {
      ...domain,
      thresholds,
    };
  });

  return {
    domains,
    moduleThresholds,
    ignoreModules,
    ignoreExportsByModule,
    ignoreDeadByModule,
  };
}

function readDirRecursive(rootDir, collector) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      readDirRecursive(absolutePath, collector);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!SCAN_EXTENSIONS.has(ext)) {
      continue;
    }

    const rel = normalizePath(path.relative(repoRoot, absolutePath));
    collector.push(rel);
  }
}

function getDomainByFile(filePath, domains) {
  for (const domain of domains) {
    if (
      domain.roots.some(
        (root) =>
          normalizePath(filePath).startsWith(`${normalizePath(root)}/`) ||
          normalizePath(filePath) === normalizePath(root),
      )
    ) {
      return domain.name;
    }
  }
  return 'unknown';
}

function collectFiles(domains) {
  const files = [];
  const missingRoots = [];
  for (const domain of domains) {
    for (const root of domain.roots) {
      const absoluteRoot = path.join(repoRoot, root);
      if (!fs.existsSync(absoluteRoot)) {
        missingRoots.push(root);
        continue;
      }

      readDirRecursive(absoluteRoot, files);
    }
  }

  return {
    files: Array.from(new Set(files)).sort(),
    missingRoots,
  };
}

function isIgnoredModule(filePath, ignoreModules) {
  if (ignoreModules.has(filePath)) {
    return true;
  }

  return DEFAULT_IGNORE_MODULE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isEntryModule(filePath) {
  return DEFAULT_ENTRY_MODULE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function resolveImportToFile(fromFile, specifier, filePathSet) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const fromDir = path.dirname(path.join(repoRoot, fromFile));
  const absoluteRaw = path.resolve(fromDir, specifier);
  const candidates = [
    absoluteRaw,
    `${absoluteRaw}.ts`,
    `${absoluteRaw}.tsx`,
    `${absoluteRaw}.js`,
    `${absoluteRaw}.jsx`,
    `${absoluteRaw}.mjs`,
    `${absoluteRaw}.cjs`,
    path.join(absoluteRaw, 'index.ts'),
    path.join(absoluteRaw, 'index.tsx'),
    path.join(absoluteRaw, 'index.js'),
    path.join(absoluteRaw, 'index.jsx'),
    path.join(absoluteRaw, 'index.mjs'),
    path.join(absoluteRaw, 'index.cjs'),
  ];

  for (const candidate of candidates) {
    const rel = normalizePath(path.relative(repoRoot, candidate));
    if (filePathSet.has(rel)) {
      return rel;
    }
  }

  return null;
}

function parseFile(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const exports = new Set();
  const imports = [];
  const importUsageByTarget = new Map();
  const topLevelDecls = [];
  const identifierCounts = new Map();

  function hasExportModifier(node) {
    return (
      Array.isArray(node.modifiers) &&
      node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    );
  }

  function addIdentifier(name) {
    const current = identifierCounts.get(name) || 0;
    identifierCounts.set(name, current + 1);
  }

  function collectIdentifiers(node) {
    if (ts.isIdentifier(node)) {
      addIdentifier(node.text);
    }
    ts.forEachChild(node, collectIdentifiers);
  }

  collectIdentifiers(sourceFile);

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text;
      imports.push({ specifier });

      const used = new Set();
      if (statement.importClause?.name) {
        used.add('default');
      }

      const namedBindings = statement.importClause?.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          used.add(element.propertyName ? element.propertyName.text : element.name.text);
        }
      }

      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        used.add('*');
      }

      importUsageByTarget.set(specifier, used);
      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text;
      imports.push({ specifier });
      const used = new Set();
      if (!statement.exportClause) {
        used.add('*');
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          used.add(element.propertyName ? element.propertyName.text : element.name.text);
        }
      }
      importUsageByTarget.set(specifier, used);
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const exported = hasExportModifier(statement);
      if (exported) {
        exports.add(statement.name.text);
      } else {
        topLevelDecls.push({ kind: 'function', name: statement.name.text });
      }
      continue;
    }

    if (ts.isClassDeclaration(statement) && statement.name) {
      const exported = hasExportModifier(statement);
      if (exported) {
        exports.add(statement.name.text);
      } else {
        topLevelDecls.push({ kind: 'class', name: statement.name.text });
      }
      continue;
    }

    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      if (hasExportModifier(statement)) {
        exports.add(statement.name.text);
      } else {
        topLevelDecls.push({ kind: 'type', name: statement.name.text });
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      const exported = hasExportModifier(statement);
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        if (exported) {
          exports.add(declaration.name.text);
        } else {
          topLevelDecls.push({ kind: 'variable', name: declaration.name.text });
        }
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      exports.add('default');
    }
  }

  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of sourceText.matchAll(dynamicImportPattern)) {
    imports.push({ specifier: match[1] });
  }

  return {
    exports,
    imports,
    importUsageByTarget,
    topLevelDecls,
    identifierCounts,
  };
}

function toSet(value) {
  if (Array.isArray(value)) {
    return new Set(value.map(String));
  }
  return new Set();
}

function withDomainThresholds(domainName, effectiveConfig) {
  const domain = effectiveConfig.domains.find((d) => d.name === domainName);
  if (domain) {
    return { ...domain.thresholds };
  }
  return { deadCode: 0, orphanExports: 0, unusedModules: 0 };
}

function applyModuleAllowance(violations, categoryKey, moduleThresholds) {
  if (!Array.isArray(violations) || violations.length === 0) {
    return [];
  }

  const grouped = new Map();
  for (const violation of violations) {
    if (!grouped.has(violation.modulePath)) {
      grouped.set(violation.modulePath, []);
    }
    grouped.get(violation.modulePath).push(violation);
  }

  const effective = [];
  for (const [modulePath, items] of grouped.entries()) {
    const override =
      moduleThresholds[modulePath] || moduleThresholds[normalizeModulePath(modulePath)] || {};
    const allowance = parseIntOrDefault(override?.[categoryKey], 0);
    const sorted = [...items].sort((a, b) => a.message.localeCompare(b.message));
    effective.push(...sorted.slice(allowance));
  }

  return effective;
}

function runAnalysis(datasetName, files, effectiveConfig) {
  const filePathSet = new Set(files.map((item) => item.filePath));
  const moduleInfo = new Map();

  for (const file of files) {
    const parsed = parseFile(file.filePath, file.content);
    moduleInfo.set(file.filePath, {
      domain: file.domain,
      exports: parsed.exports,
      importUsageByTarget: parsed.importUsageByTarget,
      topLevelDecls: parsed.topLevelDecls,
      identifierCounts: parsed.identifierCounts,
      inboundEdges: 0,
      inboundUsedNames: new Set(),
      outboundTargets: new Set(),
    });
  }

  for (const [filePath, info] of moduleInfo.entries()) {
    for (const [rawSpecifier, usedNames] of info.importUsageByTarget.entries()) {
      const resolved = resolveImportToFile(filePath, rawSpecifier, filePathSet);
      if (!resolved) {
        continue;
      }

      info.outboundTargets.add(resolved);
      const target = moduleInfo.get(resolved);
      if (!target) {
        continue;
      }

      target.inboundEdges += 1;
      for (const name of usedNames) {
        target.inboundUsedNames.add(name);
      }
    }
  }

  const failuresByDomain = new Map();

  function pushFailure(domain, type, modulePath, message) {
    if (!failuresByDomain.has(domain)) {
      failuresByDomain.set(domain, {
        deadCode: [],
        orphanExports: [],
        unusedModules: [],
      });
    }
    failuresByDomain.get(domain)[type].push({ modulePath, message });
  }

  for (const [filePath, info] of moduleInfo.entries()) {
    if (isIgnoredModule(filePath, effectiveConfig.ignoreModules)) {
      continue;
    }

    const ignoreExports = toSet(
      effectiveConfig.ignoreExportsByModule[filePath] ||
        effectiveConfig.ignoreExportsByModule[normalizeModulePath(filePath)],
    );
    const ignoreDeadCode = toSet(
      effectiveConfig.ignoreDeadByModule[filePath] ||
        effectiveConfig.ignoreDeadByModule[normalizeModulePath(filePath)],
    );

    if (info.inboundEdges === 0 && !isEntryModule(filePath)) {
      pushFailure(info.domain, 'unusedModules', filePath, `${filePath}`);
    }

    const hasWildcardUse = info.inboundUsedNames.has('*');
    if (!hasWildcardUse) {
      for (const exportedName of info.exports) {
        if (ignoreExports.has(exportedName)) {
          continue;
        }

        if (info.inboundEdges === 0 || !info.inboundUsedNames.has(exportedName)) {
          pushFailure(info.domain, 'orphanExports', filePath, `${filePath}#${exportedName}`);
        }
      }
    }

    for (const decl of info.topLevelDecls) {
      if (decl.name === 'default' || decl.name.startsWith('_') || ignoreDeadCode.has(decl.name)) {
        continue;
      }

      const refs = info.identifierCounts.get(decl.name) || 0;
      if (refs <= 1) {
        pushFailure(info.domain, 'deadCode', filePath, `${filePath}#${decl.name}`);
      }
    }
  }

  const summary = [];
  let hasFailures = false;

  const orderedDomains = Array.from(
    new Set([...effectiveConfig.domains.map((d) => d.name), ...failuresByDomain.keys()]),
  );
  for (const domainName of orderedDomains) {
    const failed = failuresByDomain.get(domainName) || {
      deadCode: [],
      orphanExports: [],
      unusedModules: [],
    };
    const domainThresholds = withDomainThresholds(domainName, effectiveConfig);
    const effectiveDead = applyModuleAllowance(
      failed.deadCode,
      'deadCode',
      effectiveConfig.moduleThresholds,
    );
    const effectiveOrphan = applyModuleAllowance(
      failed.orphanExports,
      'orphanExports',
      effectiveConfig.moduleThresholds,
    );
    const effectiveUnused = applyModuleAllowance(
      failed.unusedModules,
      'unusedModules',
      effectiveConfig.moduleThresholds,
    );

    const deadCount = effectiveDead.length;
    const orphanCount = effectiveOrphan.length;
    const unusedCount = effectiveUnused.length;

    const overDead = deadCount > domainThresholds.deadCode;
    const overOrphan = orphanCount > domainThresholds.orphanExports;
    const overUnused = unusedCount > domainThresholds.unusedModules;

    summary.push(
      `[check-structural-hygiene] domain=${domainName} deadCode=${deadCount}/${domainThresholds.deadCode} orphanExports=${orphanCount}/${domainThresholds.orphanExports} unusedModules=${unusedCount}/${domainThresholds.unusedModules}`,
    );

    if (overDead || overOrphan || overUnused) {
      hasFailures = true;
      if (overDead) {
        process.stderr.write(
          `[check-structural-hygiene] ${domainName} deadCode violations (showing up to 20):\n`,
        );
        for (const item of effectiveDead.slice(0, 20)) {
          process.stderr.write(`- ${item.message}\n`);
        }
      }

      if (overOrphan) {
        process.stderr.write(
          `[check-structural-hygiene] ${domainName} orphanExports violations (showing up to 20):\n`,
        );
        for (const item of effectiveOrphan.slice(0, 20)) {
          process.stderr.write(`- ${item.message}\n`);
        }
      }

      if (overUnused) {
        process.stderr.write(
          `[check-structural-hygiene] ${domainName} unusedModules violations (showing up to 20):\n`,
        );
        for (const item of effectiveUnused.slice(0, 20)) {
          process.stderr.write(`- ${item.message}\n`);
        }
      }
    }
  }

  for (const line of summary) {
    process.stdout.write(`${line}\n`);
  }

  if (hasFailures) {
    process.stderr.write(`[check-structural-hygiene] ${datasetName}: FAILED.\n`);
    return 1;
  }

  process.stdout.write(`[check-structural-hygiene] ${datasetName}: OK.\n`);
  return 0;
}

function buildFixtureFiles() {
  const fixtureFiles = [
    {
      filePath: 'fixtures/alpha.ts',
      domain: 'fixtures',
      content: [
        'export const usedExport = 1;',
        'export const orphanExport = 2;',
        'const deadLocal = 10;',
        'export function useValue() {',
        '  return usedExport;',
        '}',
      ].join('\n'),
    },
    {
      filePath: 'fixtures/beta.ts',
      domain: 'fixtures',
      content: ["import { usedExport } from './alpha';", 'export const value = usedExport;'].join(
        '\n',
      ),
    },
    {
      filePath: 'fixtures/gamma.ts',
      domain: 'fixtures',
      content: ['export const lonely = 42;'].join('\n'),
    },
  ];

  return fixtureFiles;
}

function runFixtureMode() {
  const fixtureConfig = {
    domains: [
      {
        name: 'fixtures',
        roots: ['fixtures'],
        thresholds: { deadCode: 0, orphanExports: 0, unusedModules: 0 },
      },
    ],
    moduleThresholds: {},
    ignoreModules: new Set(),
    ignoreExportsByModule: {},
    ignoreDeadByModule: {},
  };

  const exitCode = runAnalysis('fixture-mode', buildFixtureFiles(), fixtureConfig);
  process.exit(exitCode === 0 ? 1 : exitCode);
}

function runRepoMode() {
  const effectiveConfig = buildEffectiveConfig();
  const { files, missingRoots } = collectFiles(effectiveConfig.domains);

  if (missingRoots.length > 0) {
    process.stderr.write(
      '[check-structural-hygiene] missing configured roots; refusing false-green result.\n',
    );
    for (const root of missingRoots) {
      process.stderr.write(`- missing root: ${normalizePath(root)}\n`);
    }
    process.exit(1);
  }

  if (files.length === 0) {
    process.stderr.write(
      '[check-structural-hygiene] zero target files scanned; refusing false-green result.\n',
    );
    process.exit(1);
  }

  const repoFiles = files.map((filePath) => ({
    filePath,
    domain: getDomainByFile(filePath, effectiveConfig.domains),
    content: fs.readFileSync(path.join(repoRoot, filePath), 'utf8'),
  }));

  process.stdout.write(`[check-structural-hygiene] scanned-files=${repoFiles.length}\n`);
  const exitCode = runAnalysis('repo', repoFiles, effectiveConfig);
  process.exit(exitCode);
}

if (fixtureMode) {
  runFixtureMode();
} else {
  runRepoMode();
}

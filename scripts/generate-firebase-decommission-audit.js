#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(REPO_ROOT, 'docs', 'audits', 'firebase-decommission-audit.md');

const SEARCH_RE = /(?:firebase|\brtdb\b)/i;

const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.serena',
  '.next',
  '.cache',
]);

const SCAN_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.ps1',
  '.sh',
  '.sql',
  '.txt',
]);

const RUNTIME_DIRS = ['proxy-server/src', 'bot-mox/src', 'agent/src'];
const DOC_SCAN_DIRS = ['docs'];
const DOC_SCAN_FILES = ['ARCHITECTURE.md', 'DATABASE.md', 'README.md'];

const LEGACY_FILE_PATHS = [
  'proxy-server/src/bootstrap/firebase-admin.js',
  'proxy-server/src/repositories/rtdb/paths.js',
  'proxy-server/src/repositories/rtdb/rtdb-repository.js',
  'proxy-server/src/repositories/rtdb/tenant-paths.js',
  'scripts/migrate-rtdb-to-supabase.js',
  'scripts/verify-migration-parity.js',
  'scripts/cleanup-database.js',
  'docs/architecture/firebase-rules-policy.md',
  'docs/runbooks/rtdb-supabase-cutover.md',
  'docs/DATABASE_SCHEMA.json',
];

const FIREBASE_CONFIG_PATHS = [
  '.firebaserc',
  'firebase.json',
  'database.rules.json',
  'firestore.rules',
  'firestore.indexes.json',
];

const PACKAGE_PATHS = [
  'package.json',
  'proxy-server/package.json',
  'bot-mox/package.json',
  'scripts/package.json',
  'agent/package.json',
];

const DOC_RISK_PATTERNS = [
  /docs\/architecture\/firebase-rules-policy\.md/i,
  /docs\/runbooks\/rtdb-supabase-cutover\.md/i,
  /scripts\/migrate-rtdb-to-supabase\.js/i,
  /scripts\/verify-migration-parity\.js/i,
  /scripts\/cleanup-database\.js/i,
  /proxy-server\/src\/bootstrap\/firebase-admin\.js/i,
  /proxy-server\/src\/repositories\/rtdb\//i,
  /DATA_BACKEND\s*=\s*rtdb/i,
  /\brtdb\b\s+mode/i,
  /rollback:.*rtdb/i,
];

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function relPath(absPath) {
  return toPosix(path.relative(REPO_ROOT, absPath));
}

function shouldSkipPath(relativePath) {
  if (!relativePath) return false;
  if (relativePath.startsWith('docs/history/')) return true;
  if (relativePath.startsWith('docs/plans/')) return true;
  if (relativePath.startsWith('docs/audits/')) return true;
  if (relativePath.startsWith('scripts/node_modules/')) return true;
  if (relativePath.endsWith('package-lock.json')) return true;
  return false;
}

function shouldScanFile(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  if (!SCAN_EXTENSIONS.has(ext)) return false;
  return !shouldSkipPath(relativePath);
}

function walk(dir, collector) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;

    const abs = path.join(dir, entry.name);
    const rel = relPath(abs);

    if (shouldSkipPath(rel)) continue;

    if (entry.isDirectory()) {
      walk(abs, collector);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!shouldScanFile(rel)) continue;

    collector(abs, rel);
  }
}

function readText(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return '';
  }
}

function collectHits(baseDirs, linePattern) {
  const hits = [];

  for (const baseDir of baseDirs) {
    const absBase = path.join(REPO_ROOT, baseDir);
    if (!fs.existsSync(absBase)) continue;

    walk(absBase, (abs, rel) => {
      const content = readText(abs);
      if (!content) return;

      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!linePattern.test(line)) continue;

        hits.push({
          file: rel,
          line: i + 1,
          text: line.trim(),
        });
      }
    });
  }

  return hits;
}

function collectFileHits(files, linePattern, fileFilter) {
  const hits = [];

  for (const rel of files) {
    if (fileFilter && !fileFilter(rel)) continue;

    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;

    const content = readText(abs);
    if (!content) continue;

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!linePattern.test(line)) continue;

      hits.push({
        file: rel,
        line: i + 1,
        text: line.trim(),
      });
    }
  }

  return hits;
}

function parseDeps(pkgPath) {
  const abs = path.join(REPO_ROOT, pkgPath);
  if (!fs.existsSync(abs)) {
    return { firebase: false, firebaseAdmin: false };
  }

  try {
    const raw = fs.readFileSync(abs, 'utf8');
    const parsed = JSON.parse(raw);
    const deps = {
      ...(parsed.dependencies || {}),
      ...(parsed.devDependencies || {}),
    };

    return {
      firebase: Boolean(deps.firebase),
      firebaseAdmin: Boolean(deps['firebase-admin']),
    };
  } catch {
    return { firebase: false, firebaseAdmin: false };
  }
}

function formatStatus(open) {
  return open ? 'OPEN' : 'DONE';
}

function renderHits(hits, limit = 25) {
  if (hits.length === 0) return ['- none'];
  return hits.slice(0, limit).map((hit) => `- \`${hit.file}:${hit.line}\` - ${hit.text}`);
}

function renderList(items, limit = 50) {
  if (!items || items.length === 0) return ['- none'];
  return items.slice(0, limit).map((item) => `- \`${item}\``);
}

function isActiveDocPath(relativePath) {
  if (relativePath.startsWith('docs/history/')) return false;
  if (relativePath.startsWith('docs/plans/')) return false;
  if (relativePath.startsWith('docs/audits/')) return false;
  return relativePath.startsWith('docs/');
}

function main() {
  const runtimeHits = collectHits(RUNTIME_DIRS, SEARCH_RE);

  const activeDocHits = [
    ...collectHits(DOC_SCAN_DIRS, SEARCH_RE).filter((hit) => isActiveDocPath(hit.file)),
    ...collectFileHits(DOC_SCAN_FILES, SEARCH_RE),
  ];

  const docsRiskHits = activeDocHits.filter((hit) =>
    DOC_RISK_PATTERNS.some((pattern) => pattern.test(hit.text))
  );

  const legacyFilesPresent = LEGACY_FILE_PATHS.filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));
  const firebaseConfigFilesPresent = FIREBASE_CONFIG_PATHS.filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));

  const depsByPackage = PACKAGE_PATHS.map((pkgPath) => ({
    pkgPath,
    deps: parseDeps(pkgPath),
  }));

  const packagesWithFirebaseDeps = depsByPackage
    .filter(({ deps }) => deps.firebase || deps.firebaseAdmin)
    .map(({ pkgPath, deps }) => {
      const names = [];
      if (deps.firebase) names.push('firebase');
      if (deps.firebaseAdmin) names.push('firebase-admin');
      return `${pkgPath}: ${names.join(', ')}`;
    });

  const blockers = [
    {
      id: 'RUNTIME-01',
      open: runtimeHits.length > 0,
      area: 'runtime code',
      item: 'active code still references Firebase/RTDB',
      action: 'remove remaining code/comment/log references in runtime packages',
    },
    {
      id: 'TOOLING-01',
      open: legacyFilesPresent.length > 0,
      area: 'legacy files',
      item: 'legacy Firebase/RTDB files still exist in active paths',
      action: 'delete or archive remaining legacy files',
    },
    {
      id: 'DEP-01',
      open: packagesWithFirebaseDeps.length > 0,
      area: 'dependencies',
      item: 'package manifests still include firebase deps',
      action: 'remove firebase/firebase-admin dependencies from package manifests',
    },
    {
      id: 'CONFIG-01',
      open: firebaseConfigFilesPresent.length > 0,
      area: 'config',
      item: 'Firebase project config/rules files still exist in repo root',
      action: 'remove obsolete firebase config/rules files after migration completion',
    },
    {
      id: 'DOC-01',
      open: docsRiskHits.length > 0,
      area: 'documentation',
      item: 'active docs still reference removed legacy paths or RTDB fallback mode',
      action: 'keep legacy references only in docs/history and update active docs',
    },
  ];

  const openCount = blockers.filter((b) => b.open).length;
  const doneCount = blockers.length - openCount;
  const timestamp = new Date().toISOString();

  const lines = [];
  lines.push('# Firebase Decommission Audit');
  lines.push('');
  lines.push('Auto-generated file. Do not edit manually.');
  lines.push('');
  lines.push(`Last updated (UTC): **${timestamp}**`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- Goal: keep Firebase/RTDB fully decommissioned from active runtime/tooling paths.');
  lines.push('- Runtime target: Supabase-only backend + Supabase-only operational workflow.');
  lines.push('- Historical references are allowed only in `docs/history/*` and planning archives.');
  lines.push('');
  lines.push('## Snapshot');
  lines.push('');
  lines.push(`- Runtime refs (proxy-server/src + bot-mox/src + agent/src): **${runtimeHits.length}**`);
  lines.push(`- Legacy files still present: **${legacyFilesPresent.length}**`);
  lines.push(`- Package manifests with firebase deps: **${packagesWithFirebaseDeps.length}**`);
  lines.push(`- Firebase root config files present: **${firebaseConfigFilesPresent.length}**`);
  lines.push(`- Active docs risk refs: **${docsRiskHits.length}**`);
  lines.push(`- Open blockers: **${openCount}**`);
  lines.push(`- Completed blockers: **${doneCount}**`);
  lines.push('');
  lines.push('## Blockers');
  lines.push('');
  lines.push('| ID | Status | Area | Item | Next action |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const blocker of blockers) {
    lines.push(`| ${blocker.id} | ${formatStatus(blocker.open)} | ${blocker.area} | ${blocker.item} | ${blocker.action} |`);
  }
  lines.push('');
  lines.push('## Evidence: Runtime Refs');
  lines.push('');
  lines.push(...renderHits(runtimeHits));
  lines.push('');
  lines.push('## Evidence: Legacy Files Still Present');
  lines.push('');
  lines.push(...renderList(legacyFilesPresent));
  lines.push('');
  lines.push('## Evidence: Packages With Firebase Deps');
  lines.push('');
  lines.push(...renderList(packagesWithFirebaseDeps));
  lines.push('');
  lines.push('## Evidence: Firebase Root Config Files');
  lines.push('');
  lines.push(...renderList(firebaseConfigFilesPresent));
  lines.push('');
  lines.push('## Evidence: Active Docs Risk Refs');
  lines.push('');
  lines.push(...renderHits(docsRiskHits));
  lines.push('');
  lines.push('## Update Procedure');
  lines.push('');
  lines.push('Run after every architecture or dependency change:');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run audit:firebase:decommission');
  lines.push('```');
  lines.push('');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Audit updated: ${relPath(OUTPUT_PATH)}`);
  console.log(`Open blockers: ${openCount}, completed: ${doneCount}`);
}

main();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const scopedFiles = {
  statusMath: [
    'src/pages/licenses/page/helpers.ts',
    'src/widgets/bot-profile/ui/proxy/helpers.tsx',
  ],
  financeGrouping: [
    'src/widgets/finance/ProjectPerformanceTable.tsx',
    'src/widgets/finance/FinanceSummary.tsx',
    'src/pages/finance/mappers.ts',
    'src/pages/finance/index.tsx',
    'src/pages/datacenter/index.tsx',
  ],
};

const rules = [
  {
    id: 'status-no-isExpired-helper',
    scope: 'statusMath',
    pattern: /\bisExpired\s*\(/g,
    description: 'forbidden local status helper isExpired(...)',
  },
  {
    id: 'status-no-isExpiringSoon-helper',
    scope: 'statusMath',
    pattern: /\bisExpiringSoon\s*\(/g,
    description: 'forbidden local status helper isExpiringSoon(...)',
  },
  {
    id: 'status-no-expires-date-now-math',
    scope: 'statusMath',
    pattern: /expires_at\s*-\s*Date\.now\s*\(/g,
    description: 'forbidden local expires_at - Date.now() math',
  },
  {
    id: 'finance-no-project-map-grouping',
    scope: 'financeGrouping',
    pattern: /new\s+Map<string,\s*ProjectStats>/g,
    description: 'forbidden local finance grouping via Map<ProjectStats>',
  },
  {
    id: 'finance-no-operations-foreach-grouping',
    scope: 'financeGrouping',
    pattern: /\boperations\.forEach\s*\(/g,
    description: 'forbidden local finance regrouping with operations.forEach(...)',
  },
  {
    id: 'finance-no-local-gold-history-mapper',
    scope: 'financeGrouping',
    pattern: /\bgetGoldPriceHistoryFromOperationsLocal\b/g,
    description: 'forbidden local finance gold history mapper',
  },
];

function countOccurrences(content, pattern) {
  const matches = [...content.matchAll(pattern)];
  return matches.length;
}

function findLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function collectMatches(content, pattern) {
  const matches = [...content.matchAll(pattern)];
  return matches.map((match) => {
    const start = match.index ?? 0;
    const line = findLineNumber(content, start);
    const excerpt = (match[0] || '').trim();
    return { line, excerpt };
  });
}

function run() {
  const failures = [];
  const scannedFiles = new Set();

  if (rules.length === 0) {
    failures.push(
      '[guard-config] no forbidden-business-logic rules configured; refusing false-green result.',
    );
  }

  for (const [scope, files] of Object.entries(scopedFiles)) {
    if (!Array.isArray(files) || files.length === 0) {
      failures.push(
        `[guard-config] scope ${scope} has zero target files; refusing false-green result.`,
      );
    }
  }

  for (const rule of rules) {
    const files = scopedFiles[rule.scope] || [];
    for (const relativeFile of files) {
      const absoluteFile = path.join(rootDir, relativeFile);
      if (!fs.existsSync(absoluteFile)) {
        failures.push(
          `[missing-file] ${relativeFile} is part of guard scope but does not exist (rule ${rule.id})`,
        );
        continue;
      }

      const content = fs.readFileSync(absoluteFile, 'utf8');
      scannedFiles.add(relativeFile);
      const count = countOccurrences(content, rule.pattern);
      const allowed = 0;

      if (count > allowed) {
        const detail = collectMatches(content, rule.pattern)
          .slice(0, 6)
          .map((entry) => `line ${entry.line}: ${entry.excerpt}`)
          .join('; ');
        failures.push(
          `[forbidden-pattern] ${relativeFile} :: ${rule.id} :: found ${count}, allowed ${allowed} (strict) :: ${rule.description} :: ${detail}`,
        );
      }
    }
  }

  if (scannedFiles.size === 0) {
    failures.push('[guard-config] zero scoped files scanned; refusing false-green result.');
  }

  if (failures.length > 0) {
    process.stderr.write('Thin-client forbidden business logic guard FAILED\n');
    for (const failure of failures) {
      process.stderr.write(`${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Thin-client forbidden business logic guard passed (strict) for ${rules.length} rules across ${scannedFiles.size} scoped business files.\n`,
  );
}

run();

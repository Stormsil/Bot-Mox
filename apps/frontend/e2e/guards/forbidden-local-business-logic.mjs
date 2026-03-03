import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const strictMode = process.env.THIN_CLIENT_GUARD_STRICT === '1';

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

const baselineMaxCounts = {
  'src/pages/licenses/page/helpers.ts': {
    'status-no-isExpired-helper': 2,
    'status-no-isExpiringSoon-helper': 1,
    'status-no-expires-date-now-math': 0,
  },
  'src/widgets/bot-profile/ui/proxy/helpers.tsx': {
    'status-no-isExpired-helper': 0,
    'status-no-isExpiringSoon-helper': 0,
    'status-no-expires-date-now-math': 1,
  },
  'src/widgets/finance/ProjectPerformanceTable.tsx': {
    'finance-no-project-map-grouping': 1,
    'finance-no-operations-foreach-grouping': 1,
    'finance-no-local-gold-history-mapper': 0,
  },
  'src/widgets/finance/FinanceSummary.tsx': {
    'finance-no-project-map-grouping': 0,
    'finance-no-operations-foreach-grouping': 1,
    'finance-no-local-gold-history-mapper': 0,
  },
  'src/pages/finance/mappers.ts': {
    'finance-no-project-map-grouping': 0,
    'finance-no-operations-foreach-grouping': 0,
    'finance-no-local-gold-history-mapper': 1,
  },
  'src/pages/finance/index.tsx': {
    'finance-no-project-map-grouping': 0,
    'finance-no-operations-foreach-grouping': 0,
    'finance-no-local-gold-history-mapper': 0,
  },
  'src/pages/datacenter/index.tsx': {
    'finance-no-project-map-grouping': 0,
    'finance-no-operations-foreach-grouping': 1,
    'finance-no-local-gold-history-mapper': 0,
  },
};

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
  const modeLabel = strictMode ? 'strict' : 'baseline-regression';

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
      const count = countOccurrences(content, rule.pattern);
      const allowedByBaseline = baselineMaxCounts[relativeFile]?.[rule.id] ?? 0;
      const allowed = strictMode ? 0 : allowedByBaseline;

      if (count > allowed) {
        const detail = collectMatches(content, rule.pattern)
          .slice(0, 6)
          .map((entry) => `line ${entry.line}: ${entry.excerpt}`)
          .join('; ');
        failures.push(
          `[forbidden-pattern] ${relativeFile} :: ${rule.id} :: found ${count}, allowed ${allowed} (${modeLabel}) :: ${rule.description} :: ${detail}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write('Thin-client forbidden business logic guard FAILED\n');
    for (const failure of failures) {
      process.stderr.write(`${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Thin-client forbidden business logic guard passed (${modeLabel}) for ${rules.length} rules across scoped business files.\n`,
  );
}

run();

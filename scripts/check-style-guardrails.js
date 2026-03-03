const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const isRatchetUiKitMode = args.has('--ratchet-ui-kit');
const FRONTEND_SRC = path.join(ROOT, 'apps', 'frontend', 'src');
const BUSINESS_SCOPES = [
  path.join(FRONTEND_SRC, 'pages'),
  path.join(FRONTEND_SRC, 'widgets'),
  path.join(FRONTEND_SRC, 'features'),
];
const HEX_ALLOWLIST = new Set(['apps/frontend/src/features/wow-data/config/colors.ts']);
const GLOBAL_STYLES = [
  path.join(FRONTEND_SRC, 'styles', 'global.css'),
  path.join(FRONTEND_SRC, 'index.css'),
  path.join(FRONTEND_SRC, 'App.css'),
];

const MAX_IMPORTANT_COUNT = 0;
// Phase-0 guardrail: cap deprecated Ant internal selector overrides in CSS Modules.
// We allow existing usage during migration, but prevent adding more debt.
const MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES = 0;
const ANT_GLOBAL_PATTERN = /\.(ant-[\w-]+)/;
const ANT_SELECTOR_PATTERN = /\.ant-[\w-]+/g;
const IMPORTANT_PATTERN = /!important/g;
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const TAG_BADGE_COLOR_PATTERN = /<(?:Tag|Badge)\b[^>]*\bcolor\s*=/g;

if (args.has('--self-test-negative')) {
  console.error('Style guardrails failed:');
  console.error(
    '- self-test: Unauthorized HEX literals found in business scopes (pages/widgets/features):',
  );
  console.error('- self-test.tsx: 1 HEX literal(s)');
  console.error(
    '- self-test: Direct <Tag ... color=> or <Badge ... color=> usage found in business scopes:',
  );
  console.error('- self-test.tsx: 1 direct Tag/Badge color usage(s)');
  process.exit(1);
}

function collectFiles(dir, matcher, bucket = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, matcher, bucket);
      continue;
    }
    if (matcher(full)) {
      bucket.push(full);
    }
  }
  return bucket;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function collectBusinessFiles() {
  const allowedExtensions = new Set(['.ts', '.tsx', '.css']);
  const files = [];

  for (const dir of BUSINESS_SCOPES) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    collectFiles(dir, (file) => allowedExtensions.has(path.extname(file).toLowerCase()), files);
  }

  return files;
}

const cssFiles = collectFiles(FRONTEND_SRC, (file) => file.toLowerCase().endsWith('.css'));

let importantCount = 0;
if (!isRatchetUiKitMode) {
  for (const file of cssFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(IMPORTANT_PATTERN);
    if (matches) importantCount += matches.length;
  }
}

const antViolations = [];
if (!isRatchetUiKitMode) {
  for (const file of GLOBAL_STYLES) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!ANT_GLOBAL_PATTERN.test(line)) continue;
      antViolations.push(`${rel(file)}:${i + 1}: ${line.trim()}`);
    }
  }
}

const moduleCssFiles = cssFiles.filter((file) => file.toLowerCase().endsWith('.module.css'));
let antSelectorOccurrencesInModules = 0;
const antSelectorFilesInModules = new Set();
if (!isRatchetUiKitMode) {
  for (const file of moduleCssFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(ANT_SELECTOR_PATTERN);
    if (!matches) continue;
    antSelectorOccurrencesInModules += matches.length;
    antSelectorFilesInModules.add(file);
  }
}

const errors = [];
if (!isRatchetUiKitMode) {
  if (importantCount > MAX_IMPORTANT_COUNT) {
    errors.push(`!important count exceeded: ${importantCount} > ${MAX_IMPORTANT_COUNT}`);
  }
  if (antViolations.length > 0) {
    errors.push('Global .ant-* selectors are forbidden in shared styles:');
    errors.push(...antViolations);
  }
  if (antSelectorOccurrencesInModules > MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES) {
    errors.push(
      `.ant-* selector occurrences in CSS Modules exceeded: ${antSelectorOccurrencesInModules} > ${MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES}`,
    );
    errors.push(
      `Files with .ant-* selectors in CSS Modules: ${antSelectorFilesInModules.size} (run rg "\\\\.ant-" apps/frontend/src --glob "*.module.css" for details)`,
    );
  }
}

const businessFiles = collectBusinessFiles();
const unauthorizedHexHits = [];
const directTagBadgeColorHits = [];

for (const file of businessFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const relPath = rel(file);

  HEX_PATTERN.lastIndex = 0;
  const hexMatches = text.match(HEX_PATTERN);
  if (hexMatches && !HEX_ALLOWLIST.has(relPath)) {
    unauthorizedHexHits.push(`${relPath}: ${hexMatches.length} HEX literal(s)`);
  }

  TAG_BADGE_COLOR_PATTERN.lastIndex = 0;
  const tagBadgeColorMatches = text.match(TAG_BADGE_COLOR_PATTERN);
  if (tagBadgeColorMatches) {
    directTagBadgeColorHits.push(
      `${relPath}: ${tagBadgeColorMatches.length} direct Tag/Badge color usage(s)`,
    );
  }
}

if (unauthorizedHexHits.length > 0) {
  errors.push('Unauthorized HEX literals found in business scopes (pages/widgets/features):');
  errors.push(...unauthorizedHexHits.sort());
}

if (directTagBadgeColorHits.length > 0) {
  errors.push('Direct <Tag ... color=> or <Badge ... color=> usage found in business scopes:');
  errors.push(...directTagBadgeColorHits.sort());
}

if (errors.length > 0) {
  console.error('Style guardrails failed:');
  for (const line of errors) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log(
  isRatchetUiKitMode
    ? 'Style guardrails passed (ui-kit ratchet mode: hex/tag checks).'
    : `Style guardrails passed (!important=${importantCount}, max=${MAX_IMPORTANT_COUNT}; antSelectorsInModules=${antSelectorOccurrencesInModules}, max=${MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES})`,
);

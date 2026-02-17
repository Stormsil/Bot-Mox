const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FRONTEND_SRC = path.join(ROOT, 'bot-mox', 'src');
const GLOBAL_STYLES = [
  path.join(FRONTEND_SRC, 'styles', 'global.css'),
  path.join(FRONTEND_SRC, 'index.css'),
  path.join(FRONTEND_SRC, 'App.css'),
];

const MAX_IMPORTANT_COUNT = 19;
// Phase-0 guardrail: cap legacy Ant internal selector overrides in CSS Modules.
// We allow existing usage during migration, but prevent adding more debt.
const MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES = 37;
const ANT_GLOBAL_PATTERN = /\.(ant-[\w-]+)/;
const ANT_SELECTOR_PATTERN = /\.ant-[\w-]+/g;
const IMPORTANT_PATTERN = /!important/g;

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

const cssFiles = collectFiles(FRONTEND_SRC, (file) => file.toLowerCase().endsWith('.css'));

let importantCount = 0;
for (const file of cssFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const matches = text.match(IMPORTANT_PATTERN);
  if (matches) importantCount += matches.length;
}

const antViolations = [];
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

const moduleCssFiles = cssFiles.filter((file) => file.toLowerCase().endsWith('.module.css'));
let antSelectorOccurrencesInModules = 0;
const antSelectorFilesInModules = new Set();
for (const file of moduleCssFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const matches = text.match(ANT_SELECTOR_PATTERN);
  if (!matches) continue;
  antSelectorOccurrencesInModules += matches.length;
  antSelectorFilesInModules.add(file);
}

const errors = [];
if (importantCount > MAX_IMPORTANT_COUNT) {
  errors.push(`!important count exceeded: ${importantCount} > ${MAX_IMPORTANT_COUNT}`);
}
if (antViolations.length > 0) {
  errors.push('Global .ant-* selectors are forbidden in shared styles:');
  errors.push(...antViolations);
}
if (antSelectorOccurrencesInModules > MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES) {
  errors.push(
    `.ant-* selector occurrences in CSS Modules exceeded: ${antSelectorOccurrencesInModules} > ${MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES}`
  );
  errors.push(
    `Files with .ant-* selectors in CSS Modules: ${antSelectorFilesInModules.size} (run rg \"\\\\.ant-\" bot-mox/src --glob \"*.module.css\" for details)`
  );
}

if (errors.length > 0) {
  console.error('Style guardrails failed:');
  for (const line of errors) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log(
  `Style guardrails passed (!important=${importantCount}, max=${MAX_IMPORTANT_COUNT}; antSelectorsInModules=${antSelectorOccurrencesInModules}, max=${MAX_ANT_SELECTOR_OCCURRENCES_IN_CSS_MODULES})`
);

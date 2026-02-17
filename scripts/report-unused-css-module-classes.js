const fs = require('fs');
const path = require('path');

// Report-only helper to find obviously-unused CSS module class names.
//
// Notes:
// - Conservative by design (prefers false negatives over false positives).
// - A class is considered "used" if its token appears anywhere in TS/TSX under bot-mox/src.
// - This intentionally does NOT fail CI; it prints a report for manual cleanup work.

const ROOT = process.cwd();
const FRONTEND_SRC = path.join(ROOT, 'bot-mox', 'src');

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

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTokenRegex(token) {
  // Class tokens can contain '-' and '_' so "word boundary" is not reliable.
  // We treat it as a standalone token with delimiters that are not typical identifier chars.
  const escaped = escapeRegExp(token);
  return new RegExp(`(^|[^a-zA-Z0-9_-])${escaped}([^a-zA-Z0-9_-]|$)`, 'm');
}

const moduleCssFiles = collectFiles(FRONTEND_SRC, (file) => file.toLowerCase().endsWith('.module.css'));
const codeFiles = collectFiles(
  FRONTEND_SRC,
  (file) => file.toLowerCase().endsWith('.ts') || file.toLowerCase().endsWith('.tsx')
);

let codeBlob = '';
for (const file of codeFiles) {
  try {
    codeBlob += `\n${fs.readFileSync(file, 'utf8')}`;
  } catch (error) {
    console.warn(`[unused-css] Skipped unreadable file: ${rel(file)} (${String(error)})`);
  }
}

// Detect patterns like `foo--${bar}` in template strings. If present, any CSS module
// class starting with `foo--` is treated as potentially used.
const dynamicModifierPrefixes = new Set();
const dynamicModifierPattern = /([a-zA-Z0-9_-]+--)\$\{/g;
let dynamicMatch;
while ((dynamicMatch = dynamicModifierPattern.exec(codeBlob)) !== null) {
  dynamicModifierPrefixes.add(dynamicMatch[1]);
}

const classNamePattern = /\.([_a-zA-Z][-_a-zA-Z0-9]*)/g;

let totalCandidates = 0;
const reports = [];

for (const cssFile of moduleCssFiles) {
  const cssText = fs.readFileSync(cssFile, 'utf8');
  const classNames = new Set();
  let match;

  while ((match = classNamePattern.exec(cssText)) !== null) {
    const startIndex = match.index;

    // Ignore global selector references like :global(.wmde-markdown) which are applied
    // by third-party libs and won't be referenced by local TS/TSX code.
    const lookbehind = cssText.slice(Math.max(0, startIndex - 24), startIndex);
    if (/:global\(\s*$/.test(lookbehind) || /::global\(\s*$/.test(lookbehind)) {
      continue;
    }

    classNames.add(match[1]);
  }

  const unused = [];
  for (const className of classNames) {
    // If the token appears anywhere in code, treat it as potentially used.
    // This is conservative: common names like "root" will never be flagged.
    const tokenRegex = buildTokenRegex(className);
    const isUsedByLiteral = tokenRegex.test(codeBlob);

    let isUsedByDynamicModifier = false;
    if (!isUsedByLiteral && className.includes('--') && dynamicModifierPrefixes.size > 0) {
      for (const prefix of dynamicModifierPrefixes) {
        if (className.startsWith(prefix)) {
          isUsedByDynamicModifier = true;
          break;
        }
      }
    }

    if (!isUsedByLiteral && !isUsedByDynamicModifier) {
      unused.push(className);
    }
  }

  if (unused.length > 0) {
    totalCandidates += unused.length;
    reports.push({ file: rel(cssFile), unused: unused.sort() });
  }
}

if (reports.length === 0) {
  console.log('[unused-css] No obvious unused CSS module class candidates found.');
  process.exit(0);
}

console.log('[unused-css] Candidates (manual review required):');
if (dynamicModifierPrefixes.size > 0) {
  console.log(`[unused-css] Dynamic modifier prefixes detected: ${dynamicModifierPrefixes.size}`);
}
for (const report of reports) {
  console.log(`- ${report.file}`);
  for (const className of report.unused) {
    console.log(`  - .${className}`);
  }
}
console.log(`[unused-css] Total candidates: ${totalCandidates}`);

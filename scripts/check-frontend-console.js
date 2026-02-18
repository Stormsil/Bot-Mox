// Fail the build if frontend critical paths contain console.* usage.
// Phase-1 scope: services/hooks/pages/observability/ErrorBoundary.

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const frontendRoot = path.join(repoRoot, 'bot-mox', 'src');

const targetPaths = [
  path.join(frontendRoot, 'services'),
  path.join(frontendRoot, 'hooks'),
  path.join(frontendRoot, 'pages'),
  path.join(frontendRoot, 'observability'),
  path.join(frontendRoot, 'components', 'ui', 'ErrorBoundary.tsx'),
];

const allowlist = new Set([
  // uiLogger is the only console sink by design.
  path.join(frontendRoot, 'observability', 'uiLogger.ts'),
]);

function listSourceFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];

  const out = [];
  const stack = [targetPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
        out.push(full);
      }
    }
  }
  return out;
}

function main() {
  const files = [...new Set(targetPaths.flatMap((target) => listSourceFiles(target)))];
  const offenders = [];

  for (const file of files) {
    if (allowlist.has(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    if (/\bconsole\.(log|info|warn|error|debug)\b/.test(src)) {
      offenders.push(path.relative(repoRoot, file));
    }
  }

  if (offenders.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[check-frontend-console] console.* usage found in guarded frontend paths:\n' + offenders.join('\n')
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('[check-frontend-console] OK');
}

main();


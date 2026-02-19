// Fail the build if proxy-server/src contains console.* usage (enforce structured logging).
// Allow a small, explicit allowlist for bootstrap fallbacks.

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const backendRoot = path.join(repoRoot, 'proxy-server', 'src');

const allowlist = new Set([
  // OTel bootstrap must stay resilient even if logger deps are missing.
  path.join(backendRoot, 'observability', 'tracing.js'),
  // Runtime banner fallback uses console when logger isn't available.
  path.join(backendRoot, 'bootstrap', 'runtime.js'),
]);

function listJsFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(current, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && p.endsWith('.js')) out.push(p);
    }
  }
  return out;
}

function main() {
  const files = listJsFiles(backendRoot);
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
      '[check-backend-console] console.* usage found. Use observability/logger instead:\n' +
        offenders.join('\n'),
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('[check-backend-console] OK');
}

main();

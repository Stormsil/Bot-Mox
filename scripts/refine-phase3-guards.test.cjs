const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertNoPattern(source, pattern, message) {
  assert.equal(pattern.test(source), false, message);
}

test('phase3 guard: licenses editor modal has no custom contract props', () => {
  const source = read('apps/frontend/src/pages/licenses/page/LicenseModals.tsx');

  assertNoPattern(source, /\bmode\s*:/, 'LicenseEditorModal should not require mode prop');
  assertNoPattern(
    source,
    /\beditingLicense\s*:/,
    'LicenseEditorModal should not require editingLicense prop',
  );
  assertNoPattern(source, /\blicenses\s*:/, 'LicenseEditorModal should not require licenses prop');
});

test('phase3 guard: bot subscription modal has no legacy open/loading/onSave props', () => {
  const source = read('apps/frontend/src/components/bot/subscription/SubscriptionModal.tsx');

  assertNoPattern(source, /\bopen\s*:/, 'SubscriptionModal should not require open prop');
  assertNoPattern(source, /\bloading\s*:/, 'SubscriptionModal should not require loading prop');
  assertNoPattern(source, /\bonSave\s*:/, 'SubscriptionModal should not require onSave prop');
});

test('phase3 guard: proxy modal has no legacy CRUD callback/loading props', () => {
  const source = read('apps/frontend/src/pages/proxies/ProxyCrudModal.tsx');

  assertNoPattern(
    source,
    /\bcreateSubmitting\s*:/,
    'ProxyCrudModal should not require createSubmitting',
  );
  assertNoPattern(
    source,
    /\beditSubmitting\s*:/,
    'ProxyCrudModal should not require editSubmitting',
  );
  assertNoPattern(
    source,
    /\bonCreateFinish\s*:/,
    'ProxyCrudModal should not require onCreateFinish',
  );
  assertNoPattern(source, /\bonEditFinish\s*:/, 'ProxyCrudModal should not require onEditFinish');
});

test('phase3 guard: App has no hardcoded duplicated target route declarations', () => {
  const source = read('apps/frontend/src/App.tsx');

  assertNoPattern(
    source,
    /<Route\s+path="\/licenses"/,
    'Hardcoded /licenses route should be removed',
  );
  assertNoPattern(
    source,
    /<Route\s+path="\/proxies"/,
    'Hardcoded /proxies route should be removed',
  );
  assertNoPattern(
    source,
    /<Route\s+path="\/subscriptions"/,
    'Hardcoded /subscriptions route should be removed',
  );
});

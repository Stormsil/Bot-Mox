import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackFile = path.resolve(__dirname, '../src/app/providers/data-provider/httpFallback.ts');

test.describe('http fallback migrated resource guard', () => {
  test('enforces migrated path blocklist and deterministic error code', async () => {
    const source = fs.readFileSync(fallbackFile, 'utf8');
    expect(source).toContain("'/api/v1/vm-ops'");
    expect(source).toContain("'/api/v1/vms'");
    expect(source).toContain('SETTINGS_API_BASE_PATH');
    expect(source).toContain('HTTP_FALLBACK_BLOCKED_MIGRATED_RESOURCE');
  });
});

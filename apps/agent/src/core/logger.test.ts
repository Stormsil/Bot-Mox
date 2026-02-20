const testLogger = require('node:test');
const assertLogger = require('node:assert/strict');
const fsLogger = require('node:fs');
const osLogger = require('node:os');
const pathLogger = require('node:path');
const { Logger } = require('./logger.ts');

testLogger('Logger redacts sensitive fields from file logs', async () => {
  const tempDir = fsLogger.mkdtempSync(pathLogger.join(osLogger.tmpdir(), 'botmox-agent-logger-'));
  const logger = new Logger(tempDir);

  try {
    logger.info('test_secret_log', {
      password: 'super-secret-password',
      token: 'super-secret-token',
      nested: {
        api_key: 'super-secret-key',
      },
    });
    logger.close();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const raw = fsLogger.readFileSync(pathLogger.join(tempDir, 'agent.log'), 'utf8');
    assertLogger.ok(raw.includes('[REDACTED]'));
    assertLogger.equal(raw.includes('super-secret-password'), false);
    assertLogger.equal(raw.includes('super-secret-token'), false);
    assertLogger.equal(raw.includes('super-secret-key'), false);
  } finally {
    try {
      fsLogger.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // no-op for test cleanup
    }
  }
});

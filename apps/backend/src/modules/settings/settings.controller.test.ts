export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { SettingsController } = require('./settings.controller.ts');

function buildRequest(tenantId: string) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: 'user-1',
      email: `${tenantId}@example.local`,
      roles: ['admin'],
      tenantId,
      raw: {},
    },
  };
}

function createServiceStub() {
  return {
    getApiKeys: async () => ({}),
    updateApiKeys: async () => ({}),
    getProxy: async () => ({}),
    updateProxy: async () => ({}),
    getNotificationEvents: async () => ({}),
    updateNotificationEvents: async () => ({}),
    generateScheduleFromRequest: (input: Record<string, unknown>) => ({
      mode: input.seed !== undefined ? 'seeded' : 'random',
      seed: input.seed ?? null,
      days: {
        '0': { enabled: true, sessions: [] },
        '1': { enabled: true, sessions: [] },
        '2': { enabled: true, sessions: [] },
        '3': { enabled: true, sessions: [] },
        '4': { enabled: true, sessions: [] },
        '5': { enabled: true, sessions: [] },
        '6': { enabled: true, sessions: [] },
      },
      allowedWindows: [{ start: '07:00', end: '23:30' }],
      weekSchedule: {
        days: {
          '0': { enabled: true, sessions: [] },
          '1': { enabled: true, sessions: [] },
          '2': { enabled: true, sessions: [] },
          '3': { enabled: true, sessions: [] },
          '4': { enabled: true, sessions: [] },
          '5': { enabled: true, sessions: [] },
          '6': { enabled: true, sessions: [] },
        },
        allowedWindows: [{ start: '07:00', end: '23:30' }],
      },
      items: [],
      meta: {
        tenant_id: 'tenant-a',
        deterministic: input.seed !== undefined,
        generated_at_ms: 1700000000000,
        validation: { valid: true, errors: [] },
      },
    }),
  };
}

test('SettingsController returns deterministic code for missing bearer token', async () => {
  const controller = new SettingsController(createServiceStub());

  await assert.rejects(
    () => controller.getProxy(undefined, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
      return true;
    },
  );
});

test('SettingsController returns deterministic code for invalid proxy payload', async () => {
  const controller = new SettingsController(createServiceStub());

  await assert.rejects(
    () => controller.updateProxy('Bearer test-token', {}, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code?: string;
        message?: string;
      };
      assert.equal(response.code, 'SETTINGS_INVALID_PROXY_BODY');
      assert.equal(response.message, 'Invalid settings proxy payload');
      return true;
    },
  );
});

test('SettingsController rejects invalid schedule generation params with stable 400 envelope', async () => {
  const invalidService = {
    ...createServiceStub(),
    generateScheduleFromRequest: () => {
      throw new (require('./settings.service.ts').ScheduleValidationError)([
        'Windows must not overlap',
      ]);
    },
  };
  const typedController = new SettingsController(invalidService);

  await assert.rejects(
    () =>
      typedController.generateSchedule(
        'Bearer test-token',
        {
          seed: 1337,
          params: {
            startTime: '10:00',
            endTime: '14:00',
            useSecondWindow: true,
            startTime2: '13:00',
            endTime2: '15:00',
            targetActiveMinutes: 240,
            minSessionMinutes: 60,
            minBreakMinutes: 30,
            randomOffsetMinutes: 15,
          },
        },
        buildRequest('tenant-a'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'SETTINGS_INVALID_SCHEDULE_GENERATION_PARAMS',
        message: 'Invalid settings schedule generation params',
        details: {
          errors: ['Windows must not overlap'],
        },
      });
      return true;
    },
  );
});

test('SettingsController returns deterministic seeded schedule payload shape', async () => {
  const controller = new SettingsController(createServiceStub());

  const first = await controller.generateSchedule(
    'Bearer test-token',
    {
      seed: 1337,
      params: {
        startTime: '07:00',
        endTime: '23:30',
        useSecondWindow: false,
        targetActiveMinutes: 720,
        minSessionMinutes: 60,
        minBreakMinutes: 30,
        randomOffsetMinutes: 15,
      },
    },
    buildRequest('tenant-a'),
  );

  const second = await controller.generateSchedule(
    'Bearer test-token',
    {
      seed: 1337,
      params: {
        startTime: '07:00',
        endTime: '23:30',
        useSecondWindow: false,
        targetActiveMinutes: 720,
        minSessionMinutes: 60,
        minBreakMinutes: 30,
        randomOffsetMinutes: 15,
      },
    },
    buildRequest('tenant-a'),
  );

  assert.equal(first.success, true);
  assert.equal((first.data as { mode?: string }).mode, 'seeded');
  assert.deepEqual(first, second);
});

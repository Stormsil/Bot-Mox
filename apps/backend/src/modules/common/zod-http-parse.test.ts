export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { z } = require('zod');
const { buildTrimmedIdSchema, parseWithZodOrBadRequest } = require('./zod-http-parse.ts');

test('parseWithZodOrBadRequest returns parsed zod output for valid input', () => {
  const schema = z.object({
    count: z.coerce.number().int().min(1),
  });

  const parsed = parseWithZodOrBadRequest(
    schema,
    { count: '3' },
    {
      code: 'TEST_INVALID_BODY',
      message: 'Invalid test payload',
    },
  );

  assert.deepEqual(parsed, { count: 3 });
});

test('parseWithZodOrBadRequest throws BadRequestException with code/message/details', () => {
  const schema = z.object({
    name: z.string().min(1),
  });

  assert.throws(
    () =>
      parseWithZodOrBadRequest(
        schema,
        {},
        {
          code: 'TEST_INVALID_BODY',
          message: 'Invalid test payload',
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code: string;
        message: string;
        details?: { formErrors?: unknown[]; fieldErrors?: Record<string, unknown> };
      };
      assert.equal(response.code, 'TEST_INVALID_BODY');
      assert.equal(response.message, 'Invalid test payload');
      assert.ok(response.details);
      assert.ok(response.details?.fieldErrors);
      assert.ok(Array.isArray(response.details?.fieldErrors?.name));
      return true;
    },
  );
});

test('buildTrimmedIdSchema trims and rejects blank values', () => {
  const schema = buildTrimmedIdSchema('Thing id');

  const parsed = parseWithZodOrBadRequest(schema, '  abc  ', {
    code: 'THING_INVALID_ID',
    message: 'Invalid thing id',
  });
  assert.equal(parsed, 'abc');

  assert.throws(
    () =>
      parseWithZodOrBadRequest(schema, '   ', {
        code: 'THING_INVALID_ID',
        message: 'Invalid thing id',
      }),
    BadRequestException,
  );
});

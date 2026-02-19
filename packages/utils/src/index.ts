export function assertNonEmptyString(value: unknown, fieldName: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return normalized;
}

export function toIsoString(value: Date | number | string = new Date()): string {
  return new Date(value).toISOString();
}

export function redactSecrets(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => redactSecrets(item));
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/password|token|secret|authorization|cookie/i.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = redactSecrets(value);
  }
  return result;
}

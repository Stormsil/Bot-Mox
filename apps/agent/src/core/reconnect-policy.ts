export interface ReconnectDelayInput {
  attempt: number;
  baseMs: number;
  maxMs: number;
  jitterRatio: number;
  random?: () => number;
}

export function computeReconnectDelayMs(input: ReconnectDelayInput): number {
  const safeAttempt = Math.max(1, Math.trunc(input.attempt || 1));
  const safeBase = Math.max(100, Math.trunc(input.baseMs || 1000));
  const safeMax = Math.max(safeBase, Math.trunc(input.maxMs || 30_000));
  const safeJitter = Math.min(0.5, Math.max(0, Number(input.jitterRatio || 0)));
  const random = input.random || Math.random;

  const exponential = Math.min(safeMax, safeBase * 2 ** (safeAttempt - 1));
  const jitterRange = Math.round(exponential * safeJitter);
  if (jitterRange <= 0) {
    return exponential;
  }

  const randomOffset = Math.round((Math.max(0, Math.min(1, random())) * 2 - 1) * jitterRange);
  return Math.max(safeBase, Math.min(safeMax, exponential + randomOffset));
}

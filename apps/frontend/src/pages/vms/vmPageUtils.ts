export function normalizeCores(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.max(1, Math.trunc(parsed));
}

export function normalizeMemory(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  const mb = parsed <= 64 ? parsed * 1024 : parsed;
  if (!Number.isFinite(mb) || mb < 256) {
    return fallback;
  }

  return Math.max(256, Math.trunc(mb));
}

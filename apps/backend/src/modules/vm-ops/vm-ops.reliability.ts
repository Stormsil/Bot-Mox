export interface VmOpsReliabilityConfig {
  runningCommandMaxMs: number;
  dispatchedCommandMaxMs: number;
  dispatchMaxRequeues: number;
}

export function getVmOpsReliabilityConfig(env: NodeJS.ProcessEnv): VmOpsReliabilityConfig {
  const runningCommandMaxMs = Math.max(
    60_000,
    Number.parseInt(String(env.BOTMOX_VMOPS_RUNNING_MAX_MS || ''), 10) || 15 * 60_000,
  );
  const dispatchedCommandMaxMs = Math.max(
    15_000,
    Number.parseInt(String(env.BOTMOX_VMOPS_DISPATCHED_MAX_MS || ''), 10) || 120_000,
  );
  const dispatchMaxRequeues = Math.min(
    10,
    Math.max(
      0,
      (() => {
        const parsed = Number.parseInt(String(env.BOTMOX_VMOPS_DISPATCH_MAX_REQUEUES || ''), 10);
        if (!Number.isFinite(parsed)) {
          return 2;
        }
        return parsed;
      })(),
    ),
  );
  return {
    runningCommandMaxMs,
    dispatchedCommandMaxMs,
    dispatchMaxRequeues,
  };
}

export function extractDispatchRequeueCount(errorMessage: string | null | undefined): number {
  const normalized = String(errorMessage || '').trim();
  const match = normalized.match(/REQUEUE_COUNT:(\d+)/);
  if (!match?.[1]) {
    return 0;
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function buildRequeueMessage(
  nextRetryCount: number,
  ttlMs: number,
  previousErrorMessage: string | null | undefined,
): string {
  const previous = String(previousErrorMessage || '').trim();
  return `REQUEUE_COUNT:${nextRetryCount}; stale_dispatched>${ttlMs}ms${
    previous ? `; previous="${previous}"` : ''
  }`;
}

export function buildDeadLetterMessage(
  retryCount: number,
  ttlMs: number,
  previousErrorMessage: string | null | undefined,
): string {
  const previous = String(previousErrorMessage || '').trim();
  return `DEAD_LETTERED after ${retryCount} requeues (stale_dispatched>${ttlMs}ms)${
    previous ? `; previous="${previous}"` : ''
  }`;
}

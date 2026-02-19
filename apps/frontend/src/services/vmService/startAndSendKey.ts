import type { ProxmoxVM } from '../../types';

export interface StartAndSendKeyOptions {
  node?: string;
  key?: string;
  repeatCount?: number;
  intervalMs?: number;
  startupDelayMs?: number;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface StartAndSendKeyResultItem {
  vmid: number;
  success: boolean;
  error?: string;
}

export interface StartAndSendKeyBatchResult {
  total: number;
  ok: number;
  failed: number;
  results: StartAndSendKeyResultItem[];
}

interface SendKeySpamResult {
  attempts: number;
  sent: number;
  lastError: string | null;
}

interface StartAndSendKeyDeps {
  sleep: (ms: number) => Promise<void>;
  isRunningStatus: (status: unknown) => boolean;
  getVMStatus: (vmid: number, node: string) => Promise<ProxmoxVM>;
  waitForVmStatus: (
    vmid: number,
    node: string,
    desiredStatus: string,
    options: { timeoutMs?: number; intervalMs?: number },
  ) => Promise<ProxmoxVM>;
  waitForTask: (
    upid: unknown,
    node: string,
    options: { timeoutMs?: number; intervalMs?: number },
  ) => Promise<{ exitstatus?: string }>;
  startVM: (vmid: number, node: string) => Promise<string | null>;
  sendVMKey: (vmid: number, key: string, node: string) => Promise<void>;
}

async function waitUntilVmRunning(
  vmid: number,
  node: string,
  timeoutMs: number,
  pollIntervalMs: number,
  deps: StartAndSendKeyDeps,
): Promise<void> {
  const status = await deps.waitForVmStatus(vmid, node, 'running', {
    timeoutMs,
    intervalMs: pollIntervalMs,
  });
  if (!deps.isRunningStatus(status.status)) {
    throw new Error(
      `VM ${vmid} did not reach running state within ${Math.ceil(timeoutMs / 1000)}s`,
    );
  }
}

async function waitForTaskCompletion(
  upid: string,
  node: string,
  timeoutMs: number,
  pollIntervalMs: number,
  taskLabel: string,
  deps: StartAndSendKeyDeps,
): Promise<void> {
  const status = await deps.waitForTask(upid, node, {
    timeoutMs,
    intervalMs: pollIntervalMs,
  });
  const exitStatus = String(status?.exitstatus || '').trim();
  if (exitStatus && exitStatus.toUpperCase() !== 'OK') {
    throw new Error(`${taskLabel} failed: ${exitStatus}`);
  }
}

async function runSendKeySpam(
  vmid: number,
  options: Required<
    Pick<StartAndSendKeyOptions, 'node' | 'key' | 'repeatCount' | 'intervalMs' | 'startupDelayMs'>
  >,
  signal: { cancelled: boolean },
  deps: StartAndSendKeyDeps,
): Promise<SendKeySpamResult> {
  if (options.startupDelayMs > 0) {
    await deps.sleep(options.startupDelayMs);
  }

  let sent = 0;
  let lastError: string | null = null;

  for (let i = 0; i < options.repeatCount; i++) {
    if (signal.cancelled) break;
    try {
      await deps.sendVMKey(vmid, options.key, options.node);
      sent += 1;
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (i < options.repeatCount - 1 && options.intervalMs > 0) {
      await deps.sleep(options.intervalMs);
    }
  }

  return {
    attempts: options.repeatCount,
    sent,
    lastError,
  };
}

async function runStartAndSendKeyForVm(
  vmid: number,
  options: Required<
    Pick<
      StartAndSendKeyOptions,
      | 'node'
      | 'key'
      | 'repeatCount'
      | 'intervalMs'
      | 'startupDelayMs'
      | 'waitTimeoutMs'
      | 'pollIntervalMs'
    >
  >,
  deps: StartAndSendKeyDeps,
): Promise<void> {
  let isAlreadyRunning = false;
  try {
    const current = await deps.getVMStatus(vmid, options.node);
    isAlreadyRunning = deps.isRunningStatus(current.status);
  } catch {
    // Ignore
  }

  const spamSignal = { cancelled: false };
  const sendKeySpamPromise = runSendKeySpam(vmid, options, spamSignal, deps);

  try {
    if (!isAlreadyRunning) {
      let startUpid: string | null = null;
      try {
        startUpid = await deps.startVM(vmid, options.node);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/already running|status: running|state is running|vm is running/i.test(msg)) {
          isAlreadyRunning = true;
        } else {
          throw error;
        }
      }

      if (!isAlreadyRunning && startUpid) {
        await waitForTaskCompletion(
          startUpid,
          options.node,
          Math.max(options.waitTimeoutMs, 180000),
          options.pollIntervalMs,
          `VM ${vmid} start task`,
          deps,
        );
      }
    }

    await waitUntilVmRunning(
      vmid,
      options.node,
      options.waitTimeoutMs,
      options.pollIntervalMs,
      deps,
    );

    const spamResult = await sendKeySpamPromise;
    if (spamResult.sent === 0) {
      const lastErrorSuffix = spamResult.lastError ? ` Last error: ${spamResult.lastError}` : '';
      throw new Error(
        `VM ${vmid} did not accept key "${options.key}" during ${spamResult.attempts} attempts.${lastErrorSuffix}`,
      );
    }
  } catch (error) {
    spamSignal.cancelled = true;
    await sendKeySpamPromise;
    throw error;
  }
}

export async function startAndSendKeyBatchWithDeps(
  vmIds: number[],
  options: StartAndSendKeyOptions,
  deps: StartAndSendKeyDeps,
): Promise<StartAndSendKeyBatchResult> {
  const normalizedVmIds = Array.from(
    new Set((vmIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
  );

  if (normalizedVmIds.length === 0) {
    throw new Error('No VM IDs provided');
  }

  const effectiveOptions = {
    node: options.node || 'h1',
    key: (options.key || 'a').trim() || 'a',
    repeatCount: Math.max(1, Math.trunc(options.repeatCount ?? 10)),
    intervalMs: Math.max(0, Math.trunc(options.intervalMs ?? 1000)),
    startupDelayMs: Math.max(0, Math.trunc(options.startupDelayMs ?? 3000)),
    waitTimeoutMs: Math.max(1000, Math.trunc(options.waitTimeoutMs ?? 120000)),
    pollIntervalMs: Math.max(250, Math.trunc(options.pollIntervalMs ?? 1000)),
  };

  const results = await Promise.all(
    normalizedVmIds.map(async (vmid): Promise<StartAndSendKeyResultItem> => {
      try {
        await runStartAndSendKeyForVm(vmid, effectiveOptions, deps);
        return { vmid, success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { vmid, success: false, error: message };
      }
    }),
  );

  const ok = results.filter((item) => item.success).length;
  return {
    total: results.length,
    ok,
    failed: results.length - ok,
    results,
  };
}

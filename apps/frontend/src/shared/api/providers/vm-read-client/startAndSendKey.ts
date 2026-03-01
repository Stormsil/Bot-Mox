import {
  getVMStatus,
  isRunningStatus,
  sendVMKey,
  sleep,
  startVM,
  waitForTask,
  waitForVmStatus,
} from './core';
import type {
  SendKeySpamResult,
  StartAndSendKeyBatchResult,
  StartAndSendKeyOptions,
  StartAndSendKeyResultItem,
} from './types';

async function waitUntilVmRunning(
  vmid: number,
  node: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<void> {
  const status = await waitForVmStatus(vmid, node, 'running', {
    timeoutMs,
    intervalMs: pollIntervalMs,
  });
  if (!isRunningStatus(status.status)) {
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
): Promise<void> {
  const status = await waitForTask(upid, node, {
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
): Promise<SendKeySpamResult> {
  if (options.startupDelayMs > 0) {
    await sleep(options.startupDelayMs);
  }

  let sent = 0;
  let lastError: string | null = null;

  for (let index = 0; index < options.repeatCount; index += 1) {
    if (signal.cancelled) {
      break;
    }
    try {
      await sendVMKey(vmid, options.key, options.node);
      sent += 1;
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (index < options.repeatCount - 1 && options.intervalMs > 0) {
      await sleep(options.intervalMs);
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
): Promise<void> {
  let isAlreadyRunning = false;
  try {
    const current = await getVMStatus(vmid, options.node);
    isAlreadyRunning = isRunningStatus(current.status);
  } catch {
    // Ignore status failures and continue with start flow.
  }

  const spamSignal = { cancelled: false };
  const sendKeySpamPromise = runSendKeySpam(vmid, options, spamSignal);

  try {
    if (!isAlreadyRunning) {
      let startUpid: string | null = null;
      try {
        startUpid = await startVM(vmid, options.node);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already running|status: running|state is running|vm is running/i.test(message)) {
          isAlreadyRunning = true;
        } else {
          throw error;
        }
      }

      if (!isAlreadyRunning && startUpid) {
        await waitForTaskCompletion(
          startUpid,
          options.node,
          Math.max(options.waitTimeoutMs, 180_000),
          options.pollIntervalMs,
          `VM ${vmid} start task`,
        );
      }
    }

    await waitUntilVmRunning(vmid, options.node, options.waitTimeoutMs, options.pollIntervalMs);

    const spamResult = await sendKeySpamPromise;
    if (spamResult.sent === 0) {
      const suffix = spamResult.lastError ? ` Last error: ${spamResult.lastError}` : '';
      throw new Error(
        `VM ${vmid} did not accept key "${options.key}" during ${spamResult.attempts} attempts.${suffix}`,
      );
    }
  } catch (error) {
    spamSignal.cancelled = true;
    await sendKeySpamPromise;
    throw error;
  }
}

export async function startAndSendKeyBatch(
  vmIds: number[],
  options: StartAndSendKeyOptions = {},
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
    intervalMs: Math.max(0, Math.trunc(options.intervalMs ?? 1_000)),
    startupDelayMs: Math.max(0, Math.trunc(options.startupDelayMs ?? 3_000)),
    waitTimeoutMs: Math.max(1_000, Math.trunc(options.waitTimeoutMs ?? 120_000)),
    pollIntervalMs: Math.max(250, Math.trunc(options.pollIntervalMs ?? 1_000)),
  };

  const results = await Promise.all(
    normalizedVmIds.map(async (vmid): Promise<StartAndSendKeyResultItem> => {
      try {
        await runStartAndSendKeyForVm(vmid, effectiveOptions);
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

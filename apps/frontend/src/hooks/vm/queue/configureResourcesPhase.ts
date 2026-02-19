import {
  getVMConfig,
  resizeVMDisk,
  updateVMConfig,
  waitForTask,
} from '../../../services/vmService';
import type { VMQueueItem, VMResourceMode } from '../../../types';
import { bytesToGiBRounded, pickPrimaryVolumeFromConfig } from './storageHeuristics';
import { formatMemoryWithGb, normalizeCores, normalizeMemory, sleep } from './utils';

interface RunConfigureResourcesPhaseParams {
  item: VMQueueItem;
  vmId: number;
  vmTaskKey: string;
  apiConfig: Record<string, unknown>;
  cancelRef: { current: boolean };
  targetNode: string;
  liveTemplateCores: number;
  liveTemplateMemory: number;
  settingsTemplateCores: number;
  settingsTemplateMemory: number;
  settings: {
    projectHardware?: Record<string, { cores?: number; memory?: number; diskGiB?: number }>;
  };
  initialCores: number;
  initialMemory: number;
  log: {
    step: (message: string, itemName?: string) => void;
    taskLog: (taskKey: string, message: string, level?: 'info' | 'warn' | 'error') => void;
    table: (
      title: string,
      rows: Array<{ field: string; value: string }>,
      itemName?: string,
    ) => void;
    warn: (message: string, itemName?: string) => void;
    info: (message: string, itemName?: string) => void;
    debug: (message: string, itemName?: string) => void;
  };
}

export async function runConfigureResourcesPhase(
  params: RunConfigureResourcesPhaseParams,
): Promise<{ cores: number; memory: number }> {
  const {
    item,
    vmId,
    vmTaskKey,
    apiConfig,
    cancelRef,
    targetNode,
    liveTemplateCores,
    liveTemplateMemory,
    settingsTemplateCores,
    settingsTemplateMemory,
    settings,
    initialCores,
    initialMemory,
    log,
  } = params;

  const projectHardware = settings.projectHardware?.[item.projectId];
  const resourceMode: VMResourceMode = item.resourceMode || 'original';
  const primaryVolume = pickPrimaryVolumeFromConfig(apiConfig);
  const currentDiskGiB = primaryVolume ? bytesToGiBRounded(primaryVolume.sizeBytes) : 0;
  const configuredDiskGiB = Number(projectHardware?.diskGiB);
  const customDiskGiB = Number(item.diskGiB);
  const desiredDiskGiB =
    Number.isFinite(customDiskGiB) && customDiskGiB > 0
      ? Math.max(1, Math.trunc(customDiskGiB))
      : resourceMode === 'project' && Number.isFinite(configuredDiskGiB) && configuredDiskGiB > 0
        ? Math.max(1, Math.trunc(configuredDiskGiB))
        : null;

  if (desiredDiskGiB && primaryVolume && currentDiskGiB > 0) {
    const incrementGiB = desiredDiskGiB - currentDiskGiB;
    if (incrementGiB > 0) {
      log.step(
        `VM ${vmId}: resizing ${primaryVolume.disk} ${currentDiskGiB} -> ${desiredDiskGiB} GiB`,
        item.name,
      );
      log.taskLog(
        vmTaskKey,
        `Resizing ${primaryVolume.disk}: +${incrementGiB}G (from ${currentDiskGiB}GiB to ${desiredDiskGiB}GiB)`,
      );
      const resizeTask = await resizeVMDisk({
        vmid: vmId,
        node: targetNode,
        disk: primaryVolume.disk,
        size: `+${incrementGiB}G`,
      });
      log.debug(`VM ${vmId}: resize task UPID: ${resizeTask.upid || '(none)'}`, item.name);
      if (!resizeTask.upid || String(resizeTask.upid).trim() === '') {
        log.warn(`VM ${vmId}: resize returned no UPID, waiting briefly for convergence`, item.name);
        await sleep(1500);
      } else {
        const resizeStatus = await waitForTask(resizeTask.upid, targetNode, {
          timeoutMs: 300_000,
          intervalMs: 1_000,
        });
        if (resizeStatus.exitstatus && resizeStatus.exitstatus !== 'OK') {
          throw new Error(`VM resize task failed: ${resizeStatus.exitstatus}`);
        }
        log.info(
          `VM ${vmId}: resize task finished (${resizeStatus.exitstatus || 'OK'})`,
          item.name,
        );
        log.taskLog(vmTaskKey, `Resize task finished (${resizeStatus.exitstatus || 'OK'})`);
      }
    } else if (incrementGiB < 0) {
      log.warn(
        `VM ${vmId}: disk shrink requested (${currentDiskGiB} -> ${desiredDiskGiB} GiB). Shrinking is not supported; keeping ${currentDiskGiB} GiB.`,
        item.name,
      );
      log.taskLog(
        vmTaskKey,
        `Disk resize skipped: shrink requested (${currentDiskGiB}GiB -> ${desiredDiskGiB}GiB). Grow-only is supported.`,
        'warn',
      );
    }
  } else if (desiredDiskGiB && (!primaryVolume || currentDiskGiB <= 0)) {
    log.warn(
      `VM ${vmId}: cannot determine primary disk to resize; skipping disk resize`,
      item.name,
    );
    log.taskLog(vmTaskKey, 'Disk resize skipped: cannot detect primary volume key/size', 'warn');
  }

  const finalDiskGiB =
    desiredDiskGiB && currentDiskGiB > 0
      ? Math.max(currentDiskGiB, desiredDiskGiB)
      : currentDiskGiB;
  const diskPlanText = (() => {
    if (currentDiskGiB <= 0) {
      return desiredDiskGiB ? `${desiredDiskGiB} GiB (desired; current unknown)` : '(unknown)';
    }
    if (!desiredDiskGiB) {
      return `${finalDiskGiB} GiB (keep)`;
    }
    if (desiredDiskGiB === currentDiskGiB) {
      return `${currentDiskGiB} GiB`;
    }
    if (desiredDiskGiB > currentDiskGiB) {
      return `${currentDiskGiB} -> ${finalDiskGiB} GiB`;
    }
    return `${currentDiskGiB} GiB (keep; shrink requested ${desiredDiskGiB} GiB)`;
  })();

  const templateCores = liveTemplateCores;
  const templateMemory = liveTemplateMemory;
  const projectCores = normalizeCores(projectHardware?.cores, templateCores);
  const projectMemory = normalizeMemory(projectHardware?.memory, templateMemory);
  const modeBaseCores =
    resourceMode === 'project' || resourceMode === 'custom' ? projectCores : templateCores;
  const modeBaseMemory =
    resourceMode === 'project' || resourceMode === 'custom' ? projectMemory : templateMemory;
  const normalizedItemCores = normalizeCores(item.cores, modeBaseCores);
  const normalizedItemMemory = normalizeMemory(item.memory, modeBaseMemory);
  const staleOriginalDefaults =
    resourceMode === 'original' &&
    (item.cores === undefined ||
      item.memory === undefined ||
      (normalizedItemCores === settingsTemplateCores &&
        normalizedItemMemory === settingsTemplateMemory));
  const cores = staleOriginalDefaults ? templateCores : normalizedItemCores;
  const memory = staleOriginalDefaults ? templateMemory : normalizedItemMemory;
  const queueOverride = [
    item.cores !== undefined ? `${normalizedItemCores} cores` : 'cores=auto',
    item.memory !== undefined
      ? `memory=${formatMemoryWithGb(normalizedItemMemory)}`
      : 'memory=auto',
    desiredDiskGiB ? `disk=${desiredDiskGiB}GiB` : 'disk=keep',
  ].join(', ');

  log.taskLog(
    vmTaskKey,
    `Resource policy: source=${resourceMode === 'project' ? 'project profile' : resourceMode === 'custom' ? 'custom override' : 'original template'}, project=${item.projectId}`,
  );
  log.taskLog(
    vmTaskKey,
    `Resource resolution: template=${templateCores}/${formatMemoryWithGb(templateMemory)}, project=${projectCores}/${formatMemoryWithGb(projectMemory)}, queue=${queueOverride}`,
  );
  log.taskLog(
    vmTaskKey,
    `Resource target: cores ${initialCores} -> ${cores}, memory ${formatMemoryWithGb(initialMemory)} -> ${formatMemoryWithGb(memory)}, disk ${diskPlanText}`,
  );

  log.table(
    `Resource config - ${item.name}`,
    [
      { field: 'Project', value: item.projectId },
      {
        field: 'Mode',
        value:
          resourceMode === 'project'
            ? 'project profile'
            : resourceMode === 'custom'
              ? 'custom override'
              : 'original template',
      },
      { field: 'Cores', value: String(cores) },
      { field: 'Memory (MB)', value: String(memory) },
      {
        field: 'Disk',
        value: primaryVolume ? `${primaryVolume.disk}: ${diskPlanText}` : diskPlanText,
      },
      { field: 'Other VM settings', value: 'Kept as cloned' },
    ],
    item.name,
  );

  log.step(`VM ${vmId}: applying cores/memory`, item.name);
  log.taskLog(vmTaskKey, `Applying resources: cores=${cores}, memory=${memory}MB`);

  const applyResources = async (): Promise<void> => {
    const configTask = await updateVMConfig({
      vmid: vmId,
      node: targetNode,
      cores,
      memory,
    });
    log.debug(`VM ${vmId}: cores/memory task UPID: ${configTask.upid}`, item.name);
    if (!configTask.upid || String(configTask.upid).trim() === '') {
      log.warn(
        `VM ${vmId}: cores/memory update returned no UPID, waiting for config convergence`,
        item.name,
      );
      await sleep(1200);
      return;
    }
    const configStatus = await waitForTask(configTask.upid, targetNode, {
      timeoutMs: 120_000,
      intervalMs: 1_000,
    });
    if (configStatus.exitstatus && configStatus.exitstatus !== 'OK') {
      throw new Error(`VM config task failed: ${configStatus.exitstatus}`);
    }
    log.info(
      `VM ${vmId}: cores/memory task finished (${configStatus.exitstatus || 'OK'})`,
      item.name,
    );
    log.taskLog(vmTaskKey, `Resources task finished (${configStatus.exitstatus || 'OK'})`);
  };

  const waitForResourceConvergence = async (
    expectedCores: number,
    expectedMemory: number,
    timeoutMs = 25_000,
    intervalMs = 1_500,
  ): Promise<{
    ok: boolean;
    observedCores: number | null;
    observedMemory: number | null;
    attempts: number;
  }> => {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    let observedCores: number | null = null;
    let observedMemory: number | null = null;
    while (Date.now() < deadline && !cancelRef.current) {
      attempts += 1;
      try {
        const config = (await getVMConfig(vmId, targetNode)) as Record<string, unknown>;
        const parsedCores = Number(config.cores);
        const parsedMemory = Number(config.memory);
        observedCores =
          Number.isFinite(parsedCores) && parsedCores > 0 ? Math.trunc(parsedCores) : null;
        observedMemory =
          Number.isFinite(parsedMemory) && parsedMemory > 0 ? Math.trunc(parsedMemory) : null;
        if (observedCores === expectedCores && observedMemory === expectedMemory) {
          return { ok: true, observedCores, observedMemory, attempts };
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        log.warn(`VM ${vmId}: failed to read config during resource verify: ${msg}`, item.name);
      }
      await sleep(intervalMs);
    }
    return { ok: false, observedCores, observedMemory, attempts };
  };

  await applyResources();
  let convergence = await waitForResourceConvergence(cores, memory);
  if (!convergence.ok && !cancelRef.current) {
    log.warn(
      `VM ${vmId}: resource verify mismatch after first apply (cores=${convergence.observedCores ?? '-'}, memory=${convergence.observedMemory ?? '-'}MB), retrying once`,
      item.name,
    );
    log.taskLog(
      vmTaskKey,
      'Resource verification mismatch after first apply, retrying update',
      'warn',
    );
    await applyResources();
    convergence = await waitForResourceConvergence(cores, memory);
  }

  if (cancelRef.current) {
    throw new Error('Cancelled by user');
  }
  if (!convergence.ok) {
    throw new Error(
      `Resource verify failed: expected cores=${cores}, memory=${memory}MB, got cores=${convergence.observedCores ?? '-'}, memory=${convergence.observedMemory ?? '-'}MB`,
    );
  }

  log.taskLog(
    vmTaskKey,
    `Resources applied: cores=${cores}, memory=${memory}MB (verified in ${convergence.attempts} attempt${convergence.attempts === 1 ? '' : 's'})`,
  );

  return { cores, memory };
}

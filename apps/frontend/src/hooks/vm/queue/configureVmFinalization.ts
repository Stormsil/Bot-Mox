import { getVMConfig, registerVmResource } from '../../../services/vmService';
import type { VMQueueItem } from '../../../types';
import { TASK_CONFIG_DIFF_FIELDS } from './constants';
import {
  buildConfigDiffLines,
  buildExpectationCheck,
  clipValue,
  extractUuidAndIp,
  formatMemoryWithGb,
  logTaskFieldChanges,
  normalizeCores,
  normalizeMemory,
  proxmoxConfigToText,
  sleep,
} from './utils';

interface FinalizeVmConfigurationParams {
  item: VMQueueItem;
  vmId: number;
  vmTaskKey: string;
  cancelRef: { current: boolean };
  targetNode: string;
  log: {
    step: (message: string, itemName?: string) => void;
    taskLog: (taskKey: string, message: string, level?: 'info' | 'warn' | 'error') => void;
    warn: (message: string, itemName?: string) => void;
    table: (
      title: string,
      rows: Array<{ field: string; value: string }>,
      itemName?: string,
    ) => void;
    info: (message: string, itemName?: string) => void;
    debug: (message: string, itemName?: string) => void;
    finishTask: (taskKey: string, status: 'ok' | 'error' | 'cancelled', message: string) => void;
  };
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
  apiConfig: Record<string, unknown>;
  cores: number;
  memory: number;
  generatedIp: string;
  originalIp: string;
  effectiveUuid: string;
  effectiveIp: string;
}

export async function finalizeVmConfiguration(params: FinalizeVmConfigurationParams): Promise<{
  effectiveUuid: string;
  effectiveIp: string;
}> {
  const {
    item,
    vmId,
    vmTaskKey,
    cancelRef,
    targetNode,
    log,
    updateQueueItem,
    apiConfig,
    cores,
    memory,
    generatedIp,
    originalIp,
    effectiveUuid,
    effectiveIp,
  } = params;

  log.step(`VM ${vmId}: reading final config`, item.name);
  log.taskLog(vmTaskKey, 'Reading final VM config');

  let finalApiConfig: Record<string, unknown> | null = null;
  let finalText = '';
  let finalReadAttempts = 0;
  const finalReadDeadline = Date.now() + 20_000;
  while (Date.now() < finalReadDeadline && !cancelRef.current) {
    finalReadAttempts++;
    try {
      const candidateFinal = (await getVMConfig(vmId, targetNode)) as Record<string, unknown>;
      const candidateFinalText = proxmoxConfigToText(candidateFinal);
      if (candidateFinalText.trim().length > 50) {
        finalApiConfig = candidateFinal;
        finalText = candidateFinalText;
        break;
      }
      log.warn(
        `VM ${vmId}: final config is empty or too short, retrying (attempt ${finalReadAttempts})`,
        item.name,
      );
    } catch (finalReadErr) {
      const finalReadMsg = finalReadErr instanceof Error ? finalReadErr.message : 'Unknown error';
      log.warn(
        `VM ${vmId}: final config read failed (attempt ${finalReadAttempts}): ${finalReadMsg}`,
        item.name,
      );
    }
    await sleep(1500);
  }

  if (!finalApiConfig || !finalText) {
    throw new Error(`Could not read final VM ${vmId} config after ${finalReadAttempts} attempts`);
  }
  log.taskLog(
    vmTaskKey,
    `Final config loaded after ${finalReadAttempts} attempt${finalReadAttempts === 1 ? '' : 's'}`,
  );

  const finalMeta = extractUuidAndIp(finalText);
  const finalName = String(finalApiConfig.name || item.name);
  const finalCores = normalizeCores(finalApiConfig.cores, cores);
  const finalMemory = normalizeMemory(finalApiConfig.memory, memory);
  const resolvedUuid = finalMeta.uuid || effectiveUuid;
  const resolvedIp = finalMeta.ip || generatedIp || effectiveIp;

  log.taskLog(
    vmTaskKey,
    `Final config snapshot: name=${clipValue(finalName)}, cores=${finalCores}, memory=${formatMemoryWithGb(finalMemory)}, uuid=${resolvedUuid || '-'}, ip=${resolvedIp || '-'}`,
  );
  logTaskFieldChanges(
    log,
    vmTaskKey,
    'Verified config delta',
    buildConfigDiffLines(apiConfig, finalApiConfig, TASK_CONFIG_DIFF_FIELDS),
  );

  const expectedIp = generatedIp || originalIp || '-';
  const verifiedIp = finalMeta.ip || generatedIp || '-';
  const verifyChecks = [
    buildExpectationCheck('name', item.name, finalName),
    buildExpectationCheck('cores', String(cores), String(finalCores)),
    buildExpectationCheck('memory', `${memory}MB`, `${finalMemory}MB`),
    buildExpectationCheck('ip (SMBIOS)', expectedIp, verifiedIp),
  ];
  const failedChecks = verifyChecks.filter((check) => !check.ok);
  log.taskLog(vmTaskKey, `Final verify checks (${verifyChecks.length}):`);
  for (const check of verifyChecks) {
    log.taskLog(
      vmTaskKey,
      `  ${check.field}: expected=${check.expected}, actual=${check.actual} [${check.ok ? 'OK' : 'DIFF'}]`,
      check.ok ? 'info' : 'warn',
    );
  }
  if (failedChecks.length > 0) {
    log.taskLog(
      vmTaskKey,
      `Verify mismatches: ${failedChecks.map((check) => check.field).join(', ')}`,
      'warn',
    );
  }

  log.table(
    `Final config - ${item.name}`,
    [
      { field: 'VM ID', value: String(vmId) },
      { field: 'Name', value: clipValue(finalName) },
      { field: 'UUID', value: resolvedUuid || '(not found)' },
      { field: 'IP (SMBIOS)', value: resolvedIp || '(not found)' },
      { field: 'Cores', value: String(finalApiConfig.cores ?? cores) },
      { field: 'Memory', value: String(finalApiConfig.memory ?? memory) },
      { field: 'net0', value: clipValue(finalApiConfig.net0) },
      { field: 'sata0', value: clipValue(finalApiConfig.sata0) },
      { field: 'args', value: clipValue(finalApiConfig.args) },
    ],
    item.name,
  );
  log.taskLog(
    vmTaskKey,
    `Final verify complete (attempts=${finalReadAttempts}, mismatches=${failedChecks.length})`,
  );

  log.step(`VM ${vmId}: registering VM resource`, item.name);
  log.taskLog(vmTaskKey, 'Registering VM resource');
  log.table(
    `VM resource payload - ${item.name}`,
    [
      { field: 'UUID', value: resolvedUuid || '(missing)' },
      { field: 'Project', value: item.projectId || 'wow_tbc' },
      { field: 'Name', value: finalName },
      { field: 'IP', value: resolvedIp || '(empty)' },
    ],
    item.name,
  );

  if (!resolvedUuid) {
    log.warn('[VM registry] UUID not found, VM resource was not registered', item.name);
    log.taskLog(vmTaskKey, 'VM resource registration skipped: UUID missing', 'warn');
  } else {
    await registerVmResource({
      vmUuid: resolvedUuid,
      vmName: finalName,
      projectId: item.projectId,
      metadata: {
        source: 'vm_generator',
        vmid: vmId,
        node: targetNode,
        ip: resolvedIp || undefined,
      },
    });
    log.info('[VM registry] VM resource registered', item.name);
    log.debug(
      `[VM registry] Registered: vm_uuid=${resolvedUuid}, project_id=${item.projectId}, name=${finalName}, ip=${resolvedIp}, vmid=${vmId}, node=${targetNode}`,
      item.name,
    );
    log.taskLog(vmTaskKey, 'VM resource registered');
  }

  updateQueueItem(item.id, {
    status: 'done',
    vmId,
    ip: resolvedIp,
    uuid: resolvedUuid || undefined,
  });
  log.info(`${item.name} completed successfully!`, item.name);
  log.finishTask(vmTaskKey, 'ok', `VM ${vmId} completed successfully`);

  return { effectiveUuid: resolvedUuid, effectiveIp: resolvedIp };
}

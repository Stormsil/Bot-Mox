import { getVMConfig, updateVMConfig, waitForTask } from '../../../services/vmService/proxmoxOps';
import type { VMQueueItem } from '../../../types';
import { patchConfig } from '../../../utils/vm';
import type { VMLog } from '../../useVMLog';
import { runConfigureResourcesPhase } from './configureResourcesPhase';
import { finalizeVmConfiguration } from './configureVmFinalization';
import { fetchVmHardwareFingerprint } from './hardwareFingerprint';
import type { ClonedVmQueueItem } from './phaseTypes';
import {
  buildMutableConfigPatch,
  buildPatchChangeLines,
  clipValue,
  extractUuidAndIp,
  extractVmIndex,
  formatConfigValueFull,
  formatMemoryWithGb,
  logTaskFieldChanges,
  normalizeCores,
  normalizeMemory,
  proxmoxConfigToText,
  sleep,
} from './utils';

const FINGERPRINT_FETCH_MAX_ATTEMPTS = 3;
const FINGERPRINT_FETCH_BACKOFF_MS = [800, 1_600];

interface ConfigureVmItemParams {
  clonedItem: ClonedVmQueueItem;
  cancelRef: { current: boolean };
  targetNode: string;
  liveTemplateCores: number;
  liveTemplateMemory: number;
  settingsTemplateCores: number;
  settingsTemplateMemory: number;
  settings: {
    projectHardware?: Record<string, { cores?: number; memory?: number; diskGiB?: number }>;
  };
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
  setOperationText: (next: string) => void;
  log: VMLog;
}

export async function configureVmItem(params: ConfigureVmItemParams): Promise<number> {
  const {
    clonedItem,
    cancelRef,
    targetNode,
    liveTemplateCores,
    liveTemplateMemory,
    settingsTemplateCores,
    settingsTemplateMemory,
    settings,
    updateQueueItem,
    setOperationText,
    log,
  } = params;
  const { item, vmId } = clonedItem;
  const vmTaskKey = `vm:${item.id}`;

  updateQueueItem(item.id, { status: 'configuring' });
  setOperationText(`Configuring ${item.name}...`);
  log.taskLog(vmTaskKey, `Phase 2 started for VM ${vmId}`);

  log.step(`VM ${vmId}: waiting for config readiness`, item.name);
  log.taskLog(vmTaskKey, 'Waiting for VM config readiness');

  let apiConfig: Record<string, unknown> | null = null;
  let configText = '';
  let readAttempts = 0;
  const readDeadline = Date.now() + 30_000;
  while (Date.now() < readDeadline && !cancelRef.current) {
    readAttempts++;
    try {
      const candidateConfig = (await getVMConfig(vmId, targetNode)) as Record<string, unknown>;
      const candidateText = proxmoxConfigToText(candidateConfig);
      if (candidateText.trim().length > 50) {
        apiConfig = candidateConfig;
        configText = candidateText;
        break;
      }
      log.warn(
        `VM ${vmId}: config is empty or too short, retrying (attempt ${readAttempts})`,
        item.name,
      );
    } catch (readErr) {
      const readMsg = readErr instanceof Error ? readErr.message : 'Unknown error';
      log.warn(`VM ${vmId}: config read failed (attempt ${readAttempts}): ${readMsg}`, item.name);
    }
    await sleep(2000);
  }

  if (!apiConfig || !configText) {
    throw new Error(`Could not read VM ${vmId} config after ${readAttempts} attempts`);
  }
  log.taskLog(
    vmTaskKey,
    `Config loaded after ${readAttempts} attempt${readAttempts === 1 ? '' : 's'}`,
  );

  const ensureNotCancelled = (stage: string): void => {
    if (!cancelRef.current) {
      return;
    }
    const message = `Cancelled by user during hardware fingerprint fetch (${stage})`;
    log.warn(`VM ${vmId}: ${message}`, item.name);
    log.taskLog(vmTaskKey, message, 'warn');
    throw new Error(message);
  };

  log.step(`VM ${vmId}: fetching hardware fingerprint`, item.name);
  let hardwareFingerprint: Awaited<ReturnType<typeof fetchVmHardwareFingerprint>> | null = null;
  let fingerprintFailureReason = 'Unknown error';

  for (let attempt = 1; attempt <= FINGERPRINT_FETCH_MAX_ATTEMPTS; attempt += 1) {
    ensureNotCancelled(`before attempt ${attempt}`);
    log.taskLog(
      vmTaskKey,
      `Hardware fingerprint fetch attempt ${attempt}/${FINGERPRINT_FETCH_MAX_ATTEMPTS}`,
    );
    try {
      hardwareFingerprint = await fetchVmHardwareFingerprint();
      ensureNotCancelled(`after attempt ${attempt}`);
      log.taskLog(
        vmTaskKey,
        `Hardware fingerprint fetched on attempt ${attempt}: mac=${hardwareFingerprint.mac}, serial=${hardwareFingerprint.ssdSerial}, argsLength=${hardwareFingerprint.smbiosArgs.length}`,
      );
      break;
    } catch (fingerprintErr) {
      fingerprintFailureReason =
        fingerprintErr instanceof Error ? fingerprintErr.message : 'Unknown error';
      if (cancelRef.current) {
        ensureNotCancelled(`attempt ${attempt} error`);
      }
      log.warn(
        `VM ${vmId}: hardware fingerprint fetch failed (attempt ${attempt}/${FINGERPRINT_FETCH_MAX_ATTEMPTS}): ${fingerprintFailureReason}`,
        item.name,
      );
      log.taskLog(
        vmTaskKey,
        `Hardware fingerprint attempt ${attempt} failed: ${fingerprintFailureReason}`,
        'warn',
      );

      if (attempt >= FINGERPRINT_FETCH_MAX_ATTEMPTS) {
        break;
      }

      const backoffMs =
        FINGERPRINT_FETCH_BACKOFF_MS[attempt - 1] ??
        FINGERPRINT_FETCH_BACKOFF_MS[FINGERPRINT_FETCH_BACKOFF_MS.length - 1];
      log.taskLog(vmTaskKey, `Hardware fingerprint retry scheduled after ${backoffMs}ms`);
      ensureNotCancelled(`before backoff after attempt ${attempt}`);
      await sleep(backoffMs);
      ensureNotCancelled(`after backoff after attempt ${attempt}`);
    }
  }

  if (!hardwareFingerprint) {
    const failMessage = `Hardware fingerprint fetch failed after ${FINGERPRINT_FETCH_MAX_ATTEMPTS} attempts: ${fingerprintFailureReason}`;
    log.taskLog(vmTaskKey, failMessage, 'error');
    throw new Error(failMessage);
  }

  if (cancelRef.current) {
    const cancelMessage = 'Cancelled by user before patch generation';
    log.warn(`VM ${vmId}: ${cancelMessage}`, item.name);
    log.taskLog(vmTaskKey, cancelMessage, 'warn');
    throw new Error(cancelMessage);
  }

  let generatedIp = '';
  const originalMeta = extractUuidAndIp(configText);
  const effectiveUuid = originalMeta.uuid;
  const effectiveIp = originalMeta.ip;
  const initialCores = normalizeCores(apiConfig.cores, liveTemplateCores);
  const initialMemory = normalizeMemory(apiConfig.memory, liveTemplateMemory);

  log.taskLog(
    vmTaskKey,
    `Initial config snapshot: name=${clipValue(apiConfig.name || item.name)}, cores=${initialCores}, memory=${formatMemoryWithGb(initialMemory)}, uuid=${effectiveUuid || '-'}, ip=${effectiveIp || '-'}`,
  );

  log.table(
    `Current config - ${item.name}`,
    [
      { field: 'VM ID', value: String(vmId) },
      { field: 'Name', value: clipValue(apiConfig.name || item.name) },
      { field: 'UUID', value: effectiveUuid || '(not found)' },
      { field: 'IP (SMBIOS)', value: effectiveIp || '(not found)' },
      { field: 'net0', value: clipValue(apiConfig.net0) },
      { field: 'sata0', value: clipValue(apiConfig.sata0) },
      { field: 'args', value: clipValue(apiConfig.args) },
    ],
    item.name,
  );

  log.step(`VM ${vmId}: patching config (name=${item.name})`, item.name);
  const patchResult = patchConfig(
    configText,
    item.name,
    {
      mac: hardwareFingerprint.mac,
      ssdSerial: hardwareFingerprint.ssdSerial,
      smbiosArgs: hardwareFingerprint.smbiosArgs,
    },
    vmId,
  );
  generatedIp = patchResult.generatedIp;
  const vmIndex = extractVmIndex(item.name) ?? Math.max(1, vmId - 100);
  log.taskLog(
    vmTaskKey,
    `Patch context: vmName=${item.name}, vmIndex=${vmIndex ?? '-'}, targetBridge=${vmIndex !== null ? `vmbr${vmIndex}` : '(derived from name)'}, vncPort=${patchResult.vncPort}`,
  );
  const mutablePatch = buildMutableConfigPatch(apiConfig, patchResult.patched);
  const mutablePatchFields = Object.keys(mutablePatch);
  log.taskLog(
    vmTaskKey,
    mutablePatchFields.length > 0
      ? `Mutable patch fields: ${mutablePatchFields.join(', ')}`
      : 'No mutable fields changed',
  );
  log.taskLog(
    vmTaskKey,
    `Generated params: ip=${patchResult.generatedIp}, mac=${patchResult.generatedMac}, serial=${patchResult.generatedSerial}, vncPort=${patchResult.vncPort}`,
  );
  logTaskFieldChanges(
    log,
    vmTaskKey,
    'Generated replacements',
    buildPatchChangeLines(patchResult.changes, originalMeta.ip),
  );

  log.table(
    `Patch generated values - ${item.name}`,
    [
      { field: 'Generated IP', value: patchResult.generatedIp },
      { field: 'Generated MAC', value: patchResult.generatedMac },
      { field: 'Generated SSD serial', value: patchResult.generatedSerial },
      { field: 'Generated VNC port', value: String(patchResult.vncPort) },
    ],
    item.name,
  );
  log.diffTable(`Config changes - ${item.name}`, patchResult.changes, item.name);

  if (mutablePatchFields.length > 0) {
    log.step(`VM ${vmId}: applying mutable patch via Proxmox API`, item.name);
    log.taskLog(vmTaskKey, 'Applying mutable patch via Proxmox API');
    logTaskFieldChanges(
      log,
      vmTaskKey,
      'Mutable patch delta',
      mutablePatchFields.map(
        (field) =>
          `${field}: ${formatConfigValueFull(apiConfig[field])} -> ${formatConfigValueFull(mutablePatch[field])}`,
      ),
    );
    log.table(
      `Mutable patch payload - ${item.name}`,
      Object.entries(mutablePatch).map(([field, value]) => ({
        field,
        value: clipValue(value, 160),
      })),
      item.name,
    );

    const spoofTask = await updateVMConfig({
      vmid: vmId,
      node: targetNode,
      config: mutablePatch,
    });
    log.debug(`VM ${vmId}: mutable patch UPID: ${spoofTask.upid}`, item.name);

    if (!spoofTask.upid || String(spoofTask.upid).trim() === '') {
      log.warn(
        `VM ${vmId}: mutable patch returned no UPID, continuing with final config verification`,
        item.name,
      );
      await sleep(1200);
    } else {
      const spoofStatus = await waitForTask(spoofTask.upid, targetNode, {
        timeoutMs: 120_000,
        intervalMs: 1_000,
      });
      if (spoofStatus.exitstatus && spoofStatus.exitstatus !== 'OK') {
        throw new Error(`VM spoof config task failed: ${spoofStatus.exitstatus}`);
      }
      log.info(
        `VM ${vmId}: mutable patch task finished (${spoofStatus.exitstatus || 'OK'})`,
        item.name,
      );
      log.taskLog(vmTaskKey, `Mutable patch task finished (${spoofStatus.exitstatus || 'OK'})`);
    }
    log.taskLog(
      vmTaskKey,
      `Mutable patch applied (${mutablePatchFields.length} field${mutablePatchFields.length === 1 ? '' : 's'})`,
    );
  } else {
    log.warn('No mutable config changes detected for Proxmox API apply', item.name);
    log.taskLog(vmTaskKey, 'Mutable patch skipped: no changed fields', 'warn');
  }

  const { cores, memory } = await runConfigureResourcesPhase({
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
  });

  await finalizeVmConfiguration({
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
    originalIp: originalMeta.ip,
    effectiveUuid,
    effectiveIp,
  });

  return vmId;
}

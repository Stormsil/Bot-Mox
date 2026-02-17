import type { VMHardwareConfig, VMQueueItem, VMResourceMode } from '../../../types';
import {
  cloneVM,
  deleteVM,
  waitForTask,
  waitForVmPresence,
  listVMs,
  getClusterResources,
  getVMConfig,
  resizeVMDisk,
  updateVMConfig,
  registerVmResource,
} from '../../../services/vmService';
import { getVMSettings } from '../../../services/vmSettingsService';
import { generateIsoPayload } from '../../../services/unattendProfileService';
import { executeVmOps } from '../../../services/vmOpsService';
import { patchConfig } from '../../../utils/vm';
import { DEFAULT_HARDWARE, TASK_CONFIG_DIFF_FIELDS } from './constants';
import type { ProcessVmQueueContext } from './types';
import {
  buildConfigDiffLines,
  buildExpectationCheck,
  buildMutableConfigPatch,
  buildPatchChangeLines,
  clipValue,
  extractVmIndex,
  extractUuidAndIp,
  formatConfigValueFull,
  formatMemoryWithGb,
  logTaskFieldChanges,
  normalizeCores,
  normalizeMemory,
  normalizeProxmoxUsername,
  normalizeVmId,
  pickCloneNewId,
  proxmoxConfigToText,
  sleep,
} from './utils';

const PROJECT_DISK_FALLBACK_GIB: Record<string, number> = {
  wow_tbc: 128,
  wow_midnight: 256,
};
const LEGACY_STORAGE_PLACEHOLDER = 'disk';

function estimateProjectDiskBytes(params: { projectId: string; diskGiB?: unknown }): number {
  const configured = Number(params.diskGiB);
  const gib = Number.isFinite(configured) && configured > 0
    ? configured
    : (PROJECT_DISK_FALLBACK_GIB[params.projectId] ?? 128);
  return gib * (1024 ** 3);
}

async function loadStorageFreeBytes(targetNode: string): Promise<Map<string, number>> {
  const freeBytes = new Map<string, number>();

  const resources = await getClusterResources('storage');
  for (const resource of resources) {
    if (resource.type !== 'storage') {
      continue;
    }
    if (resource.node && String(resource.node).trim() && String(resource.node).trim() !== targetNode) {
      continue;
    }

    const storageName = String(resource.storage || '').trim();
    if (!storageName) {
      continue;
    }

    const used = Number(resource.disk);
    const total = Number(resource.maxdisk);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) {
      continue;
    }

    freeBytes.set(storageName, Math.max(0, total - used));
  }

  return freeBytes;
}

function pickBestStorageByFree(params: {
  candidates: string[];
  freeBytesByStorage: Map<string, number>;
  estimateBytes: number;
}): string | null {
  const candidates = params.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  let best: { name: string; free: number } | null = null;
  let bestFits: { name: string; free: number } | null = null;

  for (const name of candidates) {
    const free = Number(params.freeBytesByStorage.get(name));
    if (!Number.isFinite(free)) {
      continue;
    }

    if (!best || free > best.free) {
      best = { name, free };
    }

    if (free >= params.estimateBytes) {
      if (!bestFits || free > bestFits.free) {
        bestFits = { name, free };
      }
    }
  }

  return bestFits?.name || best?.name || candidates[0] || null;
}

const RESIZE_VOLUME_KEY = /^(?:ide|sata|scsi|virtio)\d+$/i;

function parseSizeBytesFromVolume(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const match = text.match(/(?:^|,)\s*size=([0-9]+(?:\.[0-9]+)?)([KMGTP])?\s*(?:,|$)/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = (match[2] || 'B').toUpperCase();
  const mul =
    unit === 'K'
      ? 1024
      : unit === 'M'
        ? 1024 ** 2
        : unit === 'G'
          ? 1024 ** 3
          : unit === 'T'
            ? 1024 ** 4
            : unit === 'P'
              ? 1024 ** 5
              : 1;

  return Math.round(amount * mul);
}

function pickPrimaryVolumeFromConfig(config: Record<string, unknown>): { disk: string; sizeBytes: number } | null {
  let best: { disk: string; sizeBytes: number } | null = null;

  for (const [key, value] of Object.entries(config)) {
    if (!RESIZE_VOLUME_KEY.test(key)) {
      continue;
    }

    const sizeBytes = parseSizeBytesFromVolume(value);
    if (!sizeBytes) {
      continue;
    }

    if (!best || sizeBytes > best.sizeBytes) {
      best = { disk: key, sizeBytes };
    }
  }

  return best;
}

function bytesToGiBRounded(bytes: number): number {
  const gib = bytes / (1024 ** 3);
  if (!Number.isFinite(gib) || gib <= 0) {
    return 0;
  }

  return Math.round(gib);
}

export async function processVmQueue(context: ProcessVmQueueContext): Promise<void> {
  const {
    log,
    usedIds,
    node,
    queueRef,
    cancelRef,
    setIsProcessing,
    setUiState,
    setOperationText,
    setReadyVmIds,
    updateQueueItem,
  } = context;
    cancelRef.current = false;
    setIsProcessing(true);
    setUiState('working');
    setReadyVmIds([]);

    try {
      const settings = await getVMSettings();
      const targetNode = node || settings.proxmox?.node || 'h1';
      const proxmoxUser = normalizeProxmoxUsername(settings.proxmox?.username);
      const templateVmId = settings.template?.vmId || 100;
      const hardwareDefaults: VMHardwareConfig = {
        ...DEFAULT_HARDWARE,
        ...(settings.hardware || {}),
      };
      const settingsTemplateCores = normalizeCores(hardwareDefaults.cores, DEFAULT_HARDWARE.cores);
      const settingsTemplateMemory = normalizeMemory(hardwareDefaults.memory, DEFAULT_HARDWARE.memory);
      let liveTemplateCores = settingsTemplateCores;
      let liveTemplateMemory = settingsTemplateMemory;

      try {
        const templateConfig = await getVMConfig(templateVmId, targetNode);
        liveTemplateCores = normalizeCores(templateConfig.cores, settingsTemplateCores);
        liveTemplateMemory = normalizeMemory(templateConfig.memory, settingsTemplateMemory);
        log.info(
          `Template VM ${templateVmId} resources from API: cores=${liveTemplateCores}, memory=${liveTemplateMemory}MB`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        log.warn(
          `Failed to read template VM ${templateVmId} config from API (${msg}). Using settings fallback: cores=${settingsTemplateCores}, memory=${settingsTemplateMemory}MB`
        );
      }

      const pendingItems = queueRef.current.filter(item => item.status === 'pending');
      if (pendingItems.length === 0) {
        log.warn('No pending items in queue');
        setIsProcessing(false);
        setUiState('ready');
        return;
      }

      const pendingDeleteItems = pendingItems.filter(item => (item.action || 'create') === 'delete');
      const pendingCreateItems = pendingItems.filter(item => (item.action || 'create') !== 'delete');
      log.step(
        `Starting batch processing: total=${pendingItems.length}, create=${pendingCreateItems.length}, delete=${pendingDeleteItems.length}`
      );

      if (pendingDeleteItems.length > 0) {
        log.step('Phase 0 - Deleting selected VMs');
      }

      let deleteSuccessCount = 0;
      let deleteErrorCount = 0;

      for (const item of pendingDeleteItems) {
        if (cancelRef.current) {
          log.warn('Processing cancelled by user');
          break;
        }

        const vmId = normalizeVmId(item.targetVmId ?? item.vmId);
        const itemName = String(item.name || '').trim() || (vmId ? `VM ${vmId}` : 'VM');
        const vmTaskKey = `vm:${item.id}`;
        log.startTask(vmTaskKey, `${itemName} - Destroy`, {
          node: targetNode,
          userName: proxmoxUser,
          vmName: itemName,
        });
        log.taskLog(vmTaskKey, 'Delete task added to processing queue');

        if (!vmId) {
          const msg = 'Delete task has invalid VM ID';
          updateQueueItem(item.id, { status: 'error', error: msg });
          log.error(`${itemName} delete failed: ${msg}`, itemName);
          log.finishTask(vmTaskKey, 'error', msg);
          deleteErrorCount += 1;
          continue;
        }

        try {
          updateQueueItem(item.id, { status: 'deleting', vmId });
          setOperationText(`Deleting ${itemName}...`);
          log.info(`Deleting ${itemName} (VM ${vmId})...`, itemName);
          log.table(`Delete parameters - ${itemName}`, [
            { field: 'VM ID', value: String(vmId) },
            { field: 'Name', value: itemName },
            { field: 'Node', value: targetNode },
            { field: 'Purge', value: 'Yes' },
            { field: 'Destroy unreferenced disks', value: 'Yes' },
          ], itemName);

          const deleteResult = await deleteVM(vmId, targetNode, {
            purge: true,
            destroyUnreferencedDisks: true,
          });
          if (deleteResult.upid) {
            log.taskLog(vmTaskKey, `Delete task UPID: ${deleteResult.upid}`);
            const status = await waitForTask(deleteResult.upid, targetNode, {
              timeoutMs: 240_000,
              intervalMs: 1_000,
            });
            if (status.exitstatus && status.exitstatus !== 'OK') {
              throw new Error(`Delete task failed: ${status.exitstatus}`);
            }
          } else {
            log.taskLog(vmTaskKey, 'Delete request returned no UPID, verifying VM removal');
          }

          const deletePresence = await waitForVmPresence(vmId, targetNode, false, {
            timeoutMs: 45_000,
            intervalMs: 1_000,
          });
          if (deletePresence.exists) {
            throw new Error(`VM ${vmId} is still present after delete request`);
          }

          updateQueueItem(item.id, { status: 'done', vmId, error: undefined });
          log.info(`${itemName} deleted successfully`, itemName);
          log.finishTask(vmTaskKey, 'ok', `VM ${vmId} deleted successfully`);
          deleteSuccessCount += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          updateQueueItem(item.id, { status: 'error', error: msg });
          log.error(`${itemName} delete failed: ${msg}`, itemName);
          log.finishTask(vmTaskKey, 'error', msg);
          deleteErrorCount += 1;
        }
      }

      if (cancelRef.current) {
        setIsProcessing(false);
        setUiState('error');
        setOperationText('');
        return;
      }

      if (pendingCreateItems.length === 0) {
        if (deleteSuccessCount > 0 && deleteErrorCount === 0) {
          setUiState('success');
        } else if (deleteSuccessCount > 0 && deleteErrorCount > 0) {
          setUiState('error');
        } else if (deleteErrorCount > 0) {
          setUiState('error');
        } else {
          setUiState('ready');
        }
        setIsProcessing(false);
        setOperationText('');
        return;
      }

      // Phase 1: clone
      log.step('Phase 1 - Cloning');
      const clonedItems: Array<{ item: VMQueueItem; vmId: number }> = [];
      let cloneErrorCount = 0;
      const reservedVmIds = new Set<number>();
      try {
        const currentVms = await listVMs(targetNode);
        currentVms.forEach(vm => reservedVmIds.add(vm.vmid));
      } catch {
        usedIds.forEach(id => reservedVmIds.add(id));
      }

      const storageAssignments = new Map<string, string>();
      if (settings.storage?.autoSelectBest) {
        const enabledTargets = Array.isArray(settings.storage.enabledDisks) && settings.storage.enabledDisks.length > 0
          ? Array.from(
            new Set(
              settings.storage.enabledDisks
                .map((v) => String(v).trim())
                .filter((value) => value && value.toLowerCase() !== LEGACY_STORAGE_PLACEHOLDER)
            )
          )
          : [];

        const statsCandidates: string[] = [];
        let remainingFree = new Map<string, number>();

        try {
          const freeBytesByStorage = await loadStorageFreeBytes(targetNode);
          statsCandidates.push(...Array.from(freeBytesByStorage.keys()));

          const normalizedEnabledTargets = enabledTargets.filter((name) => freeBytesByStorage.has(name));
          const pool = (normalizedEnabledTargets.length > 0 ? normalizedEnabledTargets : statsCandidates).filter(Boolean);
          remainingFree = new Map(pool.map((name) => [name, freeBytesByStorage.get(name) ?? 0] as const));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          log.warn(`Failed to load storage usage stats (${msg}). Falling back to basic balancing.`);
          const pool = enabledTargets.length > 0
            ? enabledTargets
            : pendingCreateItems.map((item) => String(item.storage || '').trim()).filter(Boolean);
          remainingFree = new Map(pool.map((name) => [name, 0] as const));
        }

        // Reserve space for manual items first so auto items try to spread across disks.
        for (const item of pendingCreateItems) {
          if (item.storageMode !== 'manual') {
            continue;
          }

          const storage = String(item.storage || '').trim();
          if (!storage || !remainingFree.has(storage)) {
            continue;
          }

          const estimateBytes = estimateProjectDiskBytes({
            projectId: String(item.projectId),
            diskGiB: Number.isFinite(Number(item.diskGiB)) && Number(item.diskGiB) > 0
              ? Number(item.diskGiB)
              : settings.projectHardware?.[item.projectId]?.diskGiB,
          });
          remainingFree.set(storage, (remainingFree.get(storage) ?? 0) - estimateBytes);
        }

        const candidates = Array.from(remainingFree.keys());

        for (const item of pendingCreateItems) {
          if (item.storageMode === 'manual') {
            continue;
          }

          const estimateBytes = estimateProjectDiskBytes({
            projectId: String(item.projectId),
            diskGiB: Number.isFinite(Number(item.diskGiB)) && Number(item.diskGiB) > 0
              ? Number(item.diskGiB)
              : settings.projectHardware?.[item.projectId]?.diskGiB,
          });
          const picked = pickBestStorageByFree({
            candidates,
            freeBytesByStorage: remainingFree,
            estimateBytes,
          });

          if (!picked) {
            continue;
          }

          storageAssignments.set(item.id, picked);
          remainingFree.set(picked, (remainingFree.get(picked) ?? 0) - estimateBytes);
        }

        if (storageAssignments.size > 0) {
          for (const item of pendingCreateItems) {
            const assigned = storageAssignments.get(item.id);
            if (assigned && assigned !== item.storage) {
              updateQueueItem(item.id, { storage: assigned, storageMode: 'auto' });
            }
          }
        }
      }

      for (const item of pendingCreateItems) {
        if (cancelRef.current) {
          log.warn('Processing cancelled by user');
          break;
        }

        const itemName = String(item.name || '').trim() || `VM-${Date.now()}`;
        if (itemName !== item.name) {
          updateQueueItem(item.id, { name: itemName });
        }

        const vmTaskKey = `vm:${item.id}`;
        log.startTask(vmTaskKey, `${itemName} - Clone/Configure`, {
          node: targetNode,
          userName: proxmoxUser,
          vmName: itemName,
        });
        log.taskLog(vmTaskKey, 'Task added to processing queue');

        try {
          const cloneNewId = pickCloneNewId(itemName, reservedVmIds);
          reservedVmIds.add(cloneNewId);
          updateQueueItem(item.id, { status: 'cloning' });
          setOperationText(`Cloning ${itemName}...`);
          log.info(`Cloning ${itemName}...`, itemName);

          const effectiveStorage = storageAssignments.get(item.id)
            || String(item.storage || '').trim()
            || (() => {
              const configuredDefault = String(settings.storage?.default || '').trim();
              return configuredDefault.toLowerCase() === LEGACY_STORAGE_PLACEHOLDER ? '' : configuredDefault;
            })()
            || 'data';

          log.table(`Clone parameters - ${itemName}`, [
            { field: 'Template', value: String(templateVmId) },
            { field: 'New VM ID', value: String(cloneNewId) },
            { field: 'Name', value: itemName },
            { field: 'Storage', value: effectiveStorage },
            { field: 'Format', value: item.format },
            { field: 'Full clone', value: 'Yes' },
            { field: 'Node', value: targetNode },
          ], itemName);
          log.taskLog(
            vmTaskKey,
            `Template=${templateVmId}, newid=${cloneNewId}, storage=${effectiveStorage}, format=${item.format}`
          );

          const cloneResult = await cloneVM({
            templateVmId,
            newid: cloneNewId,
            name: itemName,
            storage: effectiveStorage,
            format: item.format,
            full: true,
            node: targetNode,
          });

          log.debug(`UPID: ${cloneResult.upid}`, itemName);
          log.taskLog(vmTaskKey, `Clone task UPID: ${cloneResult.upid}`);

          if (cancelRef.current) {
            log.taskLog(vmTaskKey, 'Cancelled by user', 'warn');
            log.finishTask(vmTaskKey, 'cancelled', 'Cancelled by user');
            continue;
          }

          const cloneStatus = await waitForTask(cloneResult.upid, targetNode, {
            timeoutMs: 300_000,
            intervalMs: 1_000,
          });
          if (cloneStatus.exitstatus && cloneStatus.exitstatus !== 'OK') {
            throw new Error(`Clone task failed: ${cloneStatus.exitstatus}`);
          }
          log.debug(`Clone task finished with status: ${cloneStatus.exitstatus || 'OK'}`, item.name);

          const newVmId = cloneNewId;

          const clonePresence = await waitForVmPresence(newVmId, targetNode, true, {
            timeoutMs: 45_000,
            intervalMs: 1_000,
          });
          if (!clonePresence.exists) {
            throw new Error(`Clone task finished, but VM ${newVmId} not found on node ${targetNode}`);
          }

          updateQueueItem(item.id, { status: 'cloned', vmId: newVmId });
          clonedItems.push({ item, vmId: newVmId });
          log.info(`Clone complete - VM ID: ${newVmId}`, itemName);
          log.taskLog(vmTaskKey, `Clone complete - VM ID ${newVmId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          updateQueueItem(item.id, { status: 'error', error: msg });
          log.error(`${itemName} clone failed: ${msg}`, itemName);
          log.finishTask(vmTaskKey, 'error', msg);
          cloneErrorCount += 1;
        }
      }

      if (cancelRef.current) {
        log.warn('Processing cancelled after clone phase');
        for (const { item } of clonedItems) {
          log.finishTask(`vm:${item.id}`, 'cancelled', 'Cancelled by user');
        }
        setIsProcessing(false);
        setUiState('error');
        setOperationText('');
        return;
      }

      if (clonedItems.length === 0) {
        log.error('No VMs were cloned successfully');
        setIsProcessing(false);
        setUiState('error');
        setOperationText('');
        return;
      }

      log.step('Waiting 5 seconds before configuration phase...');
      setOperationText('Waiting before configuration...');
      await sleep(5000);

      // Phase 2: configure
      log.step('Phase 2 - Configuration');
      const completedVmIds: number[] = [];
      let configErrorCount = 0;

      for (const { item, vmId } of clonedItems) {
        if (cancelRef.current) {
          log.warn('Processing cancelled by user');
          log.finishTask(`vm:${item.id}`, 'cancelled', 'Cancelled by user');
          break;
        }

        const vmTaskKey = `vm:${item.id}`;

        try {
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
              const candidateConfig = await getVMConfig(vmId, targetNode) as Record<string, unknown>;
              const candidateText = proxmoxConfigToText(candidateConfig);
              if (candidateText.trim().length > 50) {
                apiConfig = candidateConfig;
                configText = candidateText;
                break;
              }
              log.warn(`VM ${vmId}: config is empty or too short, retrying (attempt ${readAttempts})`, item.name);
            } catch (readErr) {
              const readMsg = readErr instanceof Error ? readErr.message : 'Unknown error';
              log.warn(`VM ${vmId}: config read failed (attempt ${readAttempts}): ${readMsg}`, item.name);
            }
            await sleep(2000);
          }

          if (!apiConfig || !configText) {
            throw new Error(`Could not read VM ${vmId} config after ${readAttempts} attempts`);
          }
          log.taskLog(vmTaskKey, `Config loaded after ${readAttempts} attempt${readAttempts === 1 ? '' : 's'}`);

          let effectiveUuid = '';
          let effectiveIp = '';
          let generatedIp = '';
          const originalMeta = extractUuidAndIp(configText);
          effectiveUuid = originalMeta.uuid;
          effectiveIp = originalMeta.ip;
          const initialCores = normalizeCores(apiConfig.cores, liveTemplateCores);
          const initialMemory = normalizeMemory(apiConfig.memory, liveTemplateMemory);

          log.taskLog(
            vmTaskKey,
            `Initial config snapshot: name=${clipValue(apiConfig.name || item.name)}, cores=${initialCores}, memory=${formatMemoryWithGb(initialMemory)}, uuid=${effectiveUuid || '-'}, ip=${effectiveIp || '-'}`
          );

          log.table(`Current config - ${item.name}`, [
            { field: 'VM ID', value: String(vmId) },
            { field: 'Name', value: clipValue(apiConfig.name || item.name) },
            { field: 'UUID', value: effectiveUuid || '(not found)' },
            { field: 'IP (SMBIOS)', value: effectiveIp || '(not found)' },
            { field: 'net0', value: clipValue(apiConfig.net0) },
            { field: 'sata0', value: clipValue(apiConfig.sata0) },
            { field: 'args', value: clipValue(apiConfig.args) },
          ], item.name);

          log.step(`VM ${vmId}: patching config (name=${item.name})`, item.name);
          const patchResult = patchConfig(configText, item.name, vmId);
          generatedIp = patchResult.generatedIp;
          const vmIndex = extractVmIndex(item.name) ?? Math.max(1, vmId - 100);
          log.taskLog(
            vmTaskKey,
            `Patch context: vmName=${item.name}, vmIndex=${vmIndex ?? '-'}, targetBridge=${vmIndex !== null ? `vmbr${vmIndex}` : '(derived from name)'}, vncPort=${patchResult.vncPort}`
          );
          const mutablePatch = buildMutableConfigPatch(apiConfig, patchResult.patched);
          const mutablePatchFields = Object.keys(mutablePatch);
          log.taskLog(
            vmTaskKey,
            mutablePatchFields.length > 0
              ? `Mutable patch fields: ${mutablePatchFields.join(', ')}`
              : 'No mutable fields changed'
          );
          log.taskLog(
            vmTaskKey,
            `Generated params: ip=${patchResult.generatedIp}, mac=${patchResult.generatedMac}, serial=${patchResult.generatedSerial}, vncPort=${patchResult.vncPort}`
          );
          logTaskFieldChanges(
            log,
            vmTaskKey,
            'Generated replacements',
            buildPatchChangeLines(patchResult.changes, originalMeta.ip)
          );

          log.table(`Patch generated values - ${item.name}`, [
            { field: 'Generated IP', value: patchResult.generatedIp },
            { field: 'Generated MAC', value: patchResult.generatedMac },
            { field: 'Generated SSD serial', value: patchResult.generatedSerial },
            { field: 'Generated VNC port', value: String(patchResult.vncPort) },
          ], item.name);
          log.diffTable(`Config changes - ${item.name}`, patchResult.changes, item.name);

          if (mutablePatchFields.length > 0) {
            log.step(`VM ${vmId}: applying mutable patch via Proxmox API`, item.name);
            log.taskLog(vmTaskKey, 'Applying mutable patch via Proxmox API');
            logTaskFieldChanges(
              log,
              vmTaskKey,
              'Mutable patch delta',
              mutablePatchFields.map(field => (
                `${field}: ${formatConfigValueFull(apiConfig[field])} -> ${formatConfigValueFull(mutablePatch[field])}`
              ))
            );
            log.table(`Mutable patch payload - ${item.name}`, Object.entries(mutablePatch).map(([field, value]) => ({
              field,
              value: clipValue(value, 160),
            })), item.name);

            const spoofTask = await updateVMConfig({
              vmid: vmId,
              node: targetNode,
              config: mutablePatch,
            });
            log.debug(`VM ${vmId}: mutable patch UPID: ${spoofTask.upid}`, item.name);

            if (!spoofTask.upid || String(spoofTask.upid).trim() === '') {
              log.warn(`VM ${vmId}: mutable patch returned no UPID, continuing with final config verification`, item.name);
              await sleep(1200);
            } else {
              const spoofStatus = await waitForTask(spoofTask.upid, targetNode, {
                timeoutMs: 120_000,
                intervalMs: 1_000,
              });
              if (spoofStatus.exitstatus && spoofStatus.exitstatus !== 'OK') {
                throw new Error(`VM spoof config task failed: ${spoofStatus.exitstatus}`);
              }
              log.info(`VM ${vmId}: mutable patch task finished (${spoofStatus.exitstatus || 'OK'})`, item.name);
              log.taskLog(vmTaskKey, `Mutable patch task finished (${spoofStatus.exitstatus || 'OK'})`);
            }
            log.taskLog(
              vmTaskKey,
              `Mutable patch applied (${mutablePatchFields.length} field${mutablePatchFields.length === 1 ? '' : 's'})`
            );
          } else {
            log.warn('No mutable config changes detected for Proxmox API apply', item.name);
            log.taskLog(vmTaskKey, 'Mutable patch skipped: no changed fields', 'warn');
          }

          const projectHardware = settings.projectHardware?.[item.projectId];
          const resourceMode: VMResourceMode = item.resourceMode || 'original';

          const primaryVolume = pickPrimaryVolumeFromConfig(apiConfig);
          const currentDiskGiB = primaryVolume ? bytesToGiBRounded(primaryVolume.sizeBytes) : 0;
          const configuredDiskGiB = Number(projectHardware?.diskGiB);
          const customDiskGiB = Number(item.diskGiB);
          const desiredDiskGiB = Number.isFinite(customDiskGiB) && customDiskGiB > 0
            ? Math.max(1, Math.trunc(customDiskGiB))
            : resourceMode === 'project' && Number.isFinite(configuredDiskGiB) && configuredDiskGiB > 0
              ? Math.max(1, Math.trunc(configuredDiskGiB))
              : null;

          if (desiredDiskGiB && primaryVolume && currentDiskGiB > 0) {
            const incrementGiB = desiredDiskGiB - currentDiskGiB;

            if (incrementGiB > 0) {
              log.step(
                `VM ${vmId}: resizing ${primaryVolume.disk} ${currentDiskGiB} -> ${desiredDiskGiB} GiB`,
                item.name
              );
              log.taskLog(
                vmTaskKey,
                `Resizing ${primaryVolume.disk}: +${incrementGiB}G (from ${currentDiskGiB}GiB to ${desiredDiskGiB}GiB)`
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
                log.info(`VM ${vmId}: resize task finished (${resizeStatus.exitstatus || 'OK'})`, item.name);
                log.taskLog(vmTaskKey, `Resize task finished (${resizeStatus.exitstatus || 'OK'})`);
              }
            } else if (incrementGiB < 0) {
              log.warn(
                `VM ${vmId}: disk shrink requested (${currentDiskGiB} -> ${desiredDiskGiB} GiB). Shrinking is not supported; keeping ${currentDiskGiB} GiB.`,
                item.name
              );
              log.taskLog(
                vmTaskKey,
                `Disk resize skipped: shrink requested (${currentDiskGiB}GiB -> ${desiredDiskGiB}GiB). Grow-only is supported.`,
                'warn'
              );
            }
          } else if (desiredDiskGiB && (!primaryVolume || currentDiskGiB <= 0)) {
            log.warn(`VM ${vmId}: cannot determine primary disk to resize; skipping disk resize`, item.name);
            log.taskLog(vmTaskKey, 'Disk resize skipped: cannot detect primary volume key/size', 'warn');
          }

          const finalDiskGiB = desiredDiskGiB && currentDiskGiB > 0
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
          const projectCores = normalizeCores(
            projectHardware?.cores,
            templateCores
          );
          const projectMemory = normalizeMemory(
            projectHardware?.memory,
            templateMemory
          );
          const modeBaseCores = resourceMode === 'project' || resourceMode === 'custom' ? projectCores : templateCores;
          const modeBaseMemory = resourceMode === 'project' || resourceMode === 'custom' ? projectMemory : templateMemory;
          const normalizedItemCores = normalizeCores(item.cores, modeBaseCores);
          const normalizedItemMemory = normalizeMemory(item.memory, modeBaseMemory);
          const staleOriginalDefaults =
            resourceMode === 'original'
            && (
              item.cores === undefined
              || item.memory === undefined
              || (
                normalizedItemCores === settingsTemplateCores
                && normalizedItemMemory === settingsTemplateMemory
              )
            );
          const cores = staleOriginalDefaults ? templateCores : normalizedItemCores;
          const memory = staleOriginalDefaults ? templateMemory : normalizedItemMemory;
          const queueOverride = [
            item.cores !== undefined ? `${normalizedItemCores} cores` : 'cores=auto',
            item.memory !== undefined ? `memory=${formatMemoryWithGb(normalizedItemMemory)}` : 'memory=auto',
            desiredDiskGiB ? `disk=${desiredDiskGiB}GiB` : 'disk=keep',
          ].join(', ');
          log.taskLog(
            vmTaskKey,
            `Resource policy: source=${resourceMode === 'project' ? 'project profile' : resourceMode === 'custom' ? 'custom override' : 'original template'}, project=${item.projectId}`
          );
          log.taskLog(
            vmTaskKey,
            `Resource resolution: template=${templateCores}/${formatMemoryWithGb(templateMemory)}, project=${projectCores}/${formatMemoryWithGb(projectMemory)}, queue=${queueOverride}`
          );
          log.taskLog(
            vmTaskKey,
            `Resource target: cores ${initialCores} -> ${cores}, memory ${formatMemoryWithGb(initialMemory)} -> ${formatMemoryWithGb(memory)}, disk ${diskPlanText}`
          );

          log.table(`Resource config - ${item.name}`, [
            { field: 'Project', value: item.projectId },
            { field: 'Mode', value: resourceMode === 'project' ? 'project profile' : resourceMode === 'custom' ? 'custom override' : 'original template' },
            { field: 'Cores', value: String(cores) },
            { field: 'Memory (MB)', value: String(memory) },
            { field: 'Disk', value: primaryVolume ? `${primaryVolume.disk}: ${diskPlanText}` : diskPlanText },
            { field: 'Other VM settings', value: 'Kept as cloned' },
          ], item.name);

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
                item.name
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
            log.info(`VM ${vmId}: cores/memory task finished (${configStatus.exitstatus || 'OK'})`, item.name);
            log.taskLog(vmTaskKey, `Resources task finished (${configStatus.exitstatus || 'OK'})`);
          };

          const waitForResourceConvergence = async (
            expectedCores: number,
            expectedMemory: number,
            timeoutMs = 25_000,
            intervalMs = 1_500
          ): Promise<{ ok: boolean; observedCores: number | null; observedMemory: number | null; attempts: number }> => {
            const deadline = Date.now() + timeoutMs;
            let attempts = 0;
            let observedCores: number | null = null;
            let observedMemory: number | null = null;

            while (Date.now() < deadline && !cancelRef.current) {
              attempts += 1;
              try {
                const config = await getVMConfig(vmId, targetNode) as Record<string, unknown>;
                const parsedCores = Number(config.cores);
                const parsedMemory = Number(config.memory);
                observedCores = Number.isFinite(parsedCores) && parsedCores > 0
                  ? Math.trunc(parsedCores)
                  : null;
                observedMemory = Number.isFinite(parsedMemory) && parsedMemory > 0
                  ? Math.trunc(parsedMemory)
                  : null;

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
              item.name
            );
            log.taskLog(vmTaskKey, 'Resource verification mismatch after first apply, retrying update', 'warn');
            await applyResources();
            convergence = await waitForResourceConvergence(cores, memory);
          }

          if (cancelRef.current) {
            throw new Error('Cancelled by user');
          }

          if (!convergence.ok) {
            throw new Error(
              `Resource verify failed: expected cores=${cores}, memory=${memory}MB, got cores=${convergence.observedCores ?? '-'}, memory=${convergence.observedMemory ?? '-'}MB`
            );
          }

          log.taskLog(
            vmTaskKey,
            `Resources applied: cores=${cores}, memory=${memory}MB (verified in ${convergence.attempts} attempt${convergence.attempts === 1 ? '' : 's'})`
          );

          log.step(`VM ${vmId}: reading final config`, item.name);
          log.taskLog(vmTaskKey, 'Reading final VM config');
          let finalApiConfig: Record<string, unknown> | null = null;
          let finalText = '';
          let finalReadAttempts = 0;
          const finalReadDeadline = Date.now() + 20_000;
          while (Date.now() < finalReadDeadline && !cancelRef.current) {
            finalReadAttempts++;
            try {
              const candidateFinal = await getVMConfig(vmId, targetNode) as Record<string, unknown>;
              const candidateFinalText = proxmoxConfigToText(candidateFinal);
              if (candidateFinalText.trim().length > 50) {
                finalApiConfig = candidateFinal;
                finalText = candidateFinalText;
                break;
              }
              log.warn(`VM ${vmId}: final config is empty or too short, retrying (attempt ${finalReadAttempts})`, item.name);
            } catch (finalReadErr) {
              const finalReadMsg = finalReadErr instanceof Error ? finalReadErr.message : 'Unknown error';
              log.warn(`VM ${vmId}: final config read failed (attempt ${finalReadAttempts}): ${finalReadMsg}`, item.name);
            }
            await sleep(1500);
          }

          if (!finalApiConfig || !finalText) {
            throw new Error(`Could not read final VM ${vmId} config after ${finalReadAttempts} attempts`);
          }
          log.taskLog(vmTaskKey, `Final config loaded after ${finalReadAttempts} attempt${finalReadAttempts === 1 ? '' : 's'}`);

          const finalMeta = extractUuidAndIp(finalText);
          const finalName = String(finalApiConfig.name || item.name);
          const finalCores = normalizeCores(finalApiConfig.cores, cores);
          const finalMemory = normalizeMemory(finalApiConfig.memory, memory);
          log.taskLog(
            vmTaskKey,
            `Final config snapshot: name=${clipValue(finalName)}, cores=${finalCores}, memory=${formatMemoryWithGb(finalMemory)}, uuid=${finalMeta.uuid || effectiveUuid || '-'}, ip=${finalMeta.ip || generatedIp || '-'}`
          );
          logTaskFieldChanges(
            log,
            vmTaskKey,
            'Verified config delta',
            buildConfigDiffLines(apiConfig, finalApiConfig, TASK_CONFIG_DIFF_FIELDS)
          );
          const expectedIp = generatedIp || originalMeta.ip || '-';
          const verifiedIp = finalMeta.ip || generatedIp || '-';
          const verifyChecks = [
            buildExpectationCheck('name', item.name, finalName),
            buildExpectationCheck('cores', String(cores), String(finalCores)),
            buildExpectationCheck('memory', `${memory}MB`, `${finalMemory}MB`),
            buildExpectationCheck('ip (SMBIOS)', expectedIp, verifiedIp),
          ];
          const failedChecks = verifyChecks.filter(check => !check.ok);
          log.taskLog(vmTaskKey, `Final verify checks (${verifyChecks.length}):`);
          for (const check of verifyChecks) {
            log.taskLog(
              vmTaskKey,
              `  ${check.field}: expected=${check.expected}, actual=${check.actual} [${check.ok ? 'OK' : 'DIFF'}]`,
              check.ok ? 'info' : 'warn'
            );
          }
          if (failedChecks.length > 0) {
            log.taskLog(
              vmTaskKey,
              `Verify mismatches: ${failedChecks.map(check => check.field).join(', ')}`,
              'warn'
            );
          }

          log.table(`Final config - ${item.name}`, [
            { field: 'VM ID', value: String(vmId) },
            { field: 'Name', value: clipValue(finalName) },
            { field: 'UUID', value: finalMeta.uuid || effectiveUuid || '(not found)' },
            { field: 'IP (SMBIOS)', value: finalMeta.ip || generatedIp || '(not found)' },
            { field: 'Cores', value: String(finalApiConfig.cores ?? cores) },
            { field: 'Memory', value: String(finalApiConfig.memory ?? memory) },
            { field: 'net0', value: clipValue(finalApiConfig.net0) },
            { field: 'sata0', value: clipValue(finalApiConfig.sata0) },
            { field: 'args', value: clipValue(finalApiConfig.args) },
          ], item.name);
          log.taskLog(vmTaskKey, `Final verify complete (attempts=${finalReadAttempts}, mismatches=${failedChecks.length})`);

          effectiveUuid = finalMeta.uuid || effectiveUuid;
          effectiveIp = finalMeta.ip || generatedIp || effectiveIp;
          const effectiveName = finalName || item.name;

          log.step(`VM ${vmId}: registering VM resource`, item.name);
          log.taskLog(vmTaskKey, 'Registering VM resource');
          log.table(`VM resource payload - ${item.name}`, [
            { field: 'UUID', value: effectiveUuid || '(missing)' },
            { field: 'Project', value: item.projectId || 'wow_tbc' },
            { field: 'Name', value: effectiveName },
            { field: 'IP', value: effectiveIp || '(empty)' },
          ], item.name);

          if (!effectiveUuid) {
            log.warn('[VM registry] UUID not found, VM resource was not registered', item.name);
            log.taskLog(vmTaskKey, 'VM resource registration skipped: UUID missing', 'warn');
          } else {
            await registerVmResource({
              vmUuid: effectiveUuid,
              vmName: effectiveName,
              projectId: item.projectId,
              metadata: {
                source: 'vm_generator',
                vmid: vmId,
                node: targetNode,
                ip: effectiveIp || undefined,
              },
            });
            log.info('[VM registry] VM resource registered', item.name);
            log.debug(
              `[VM registry] Registered: vm_uuid=${effectiveUuid}, project_id=${item.projectId}, name=${effectiveName}, ip=${effectiveIp}, vmid=${vmId}, node=${targetNode}`,
              item.name
            );
            log.taskLog(vmTaskKey, 'VM resource registered');
          }

          updateQueueItem(item.id, {
            status: 'done',
            vmId,
            ip: effectiveIp,
            uuid: effectiveUuid || undefined,
          });
          completedVmIds.push(vmId);
          log.info(`${item.name} completed successfully!`, item.name);
          log.finishTask(vmTaskKey, 'ok', `VM ${vmId} completed successfully`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          updateQueueItem(item.id, { status: 'error', error: msg });
          log.error(`${item.name} configuration failed: ${msg}`, item.name);
          const failStatus = cancelRef.current ? 'cancelled' : 'error';
          log.finishTask(vmTaskKey, failStatus, msg);
          configErrorCount += 1;
        }
      }

      if (cancelRef.current) {
        for (const { item } of clonedItems) {
          log.finishTask(`vm:${item.id}`, 'cancelled', 'Cancelled by user');
        }
      }

      // Phase 3: Provisioning ISO
      const provisionedVmIds: number[] = [];
      let provisionErrorCount = 0;

      if (completedVmIds.length > 0 && !cancelRef.current) {
        log.step('Phase 3 - Provisioning ISO');

        for (const { item, vmId } of clonedItems) {
          if (cancelRef.current) {
            log.warn('Processing cancelled by user');
            break;
          }

          // Only process successfully completed items
          const currentItem = queueRef.current.find(qi => qi.id === item.id);
          if (!currentItem || currentItem.status !== 'done') {
            continue;
          }

          const vmTaskKey = `vm:${item.id}`;
          const itemIp = currentItem.ip || '';
          const itemUuid = currentItem.uuid || '';

          if (!itemUuid || !itemIp) {
            log.warn(`VM ${vmId}: skipping ISO provisioning — missing UUID or IP`, item.name);
            log.taskLog(vmTaskKey, 'ISO provisioning skipped: missing UUID or IP', 'warn');
            continue;
          }

          try {
            updateQueueItem(item.id, { status: 'provisioning' });
            setOperationText(`Provisioning ISO for ${item.name}...`);
            log.taskLog(vmTaskKey, 'Phase 3 started — generating provisioning ISO');

            // Parse IP into components (format: 10.0.X.Y)
            const ipParts = itemIp.split('.');
            const gateway = ipParts.length >= 3
              ? `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1`
              : '10.0.0.1';

            const isoPayload = await generateIsoPayload({
              vm_uuid: itemUuid,
              ip: {
                address: itemIp,
                netmask: '255.255.255.0',
                gateway,
                dns: ['8.8.8.8'],
              },
              vm_name: item.name,
              profile_id: currentItem.unattendProfileId,
              playbook_id: currentItem.playbookId,
            });

            const files = isoPayload.data?.files;
            if (!files || Object.keys(files).length === 0) {
              throw new Error('generateIsoPayload returned no files');
            }

            log.info(`VM ${vmId}: ISO payload generated (${Object.keys(files).length} files)`, item.name);
            log.taskLog(vmTaskKey, `ISO payload generated: ${Object.keys(files).join(', ')}`);

            // Create ISO on Proxmox host
            const isoName = `provision-${vmId}.iso`;
            log.taskLog(vmTaskKey, `Creating ISO: ${isoName}`);

            await executeVmOps({
              type: 'proxmox',
              action: 'create-provision-iso',
              params: {
                vmid: vmId,
                files,
                isoName,
                node: targetNode,
              },
              timeoutMs: 60_000,
            });

            log.info(`VM ${vmId}: ISO created on host`, item.name);
            log.taskLog(vmTaskKey, `ISO ${isoName} created on host`);

            // Attach ISO as CD-ROM
            const isoPath = `local:iso/${isoName}`;
            log.taskLog(vmTaskKey, `Attaching ISO: ${isoPath}`);

            await executeVmOps({
              type: 'proxmox',
              action: 'attach-cdrom',
              params: {
                vmid: vmId,
                isoPath,
                node: targetNode,
              },
              timeoutMs: 30_000,
            });

            log.info(`VM ${vmId}: ISO attached as CD-ROM`, item.name);
            log.taskLog(vmTaskKey, 'ISO attached as ide2 CD-ROM');

            updateQueueItem(item.id, { status: 'done' });
            provisionedVmIds.push(vmId);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            log.warn(`VM ${vmId}: ISO provisioning failed: ${msg}`, item.name);
            log.taskLog(vmTaskKey, `ISO provisioning failed: ${msg}`, 'warn');
            // Revert status to done — ISO is optional, VM is still usable
            updateQueueItem(item.id, { status: 'done' });
            provisionErrorCount += 1;
          }
        }

        if (provisionedVmIds.length > 0) {
          log.step(`Phase 3 complete: ${provisionedVmIds.length} VMs provisioned with ISO`);
        }
        if (provisionErrorCount > 0) {
          log.warn(`Phase 3: ${provisionErrorCount} ISO provisioning error(s) (non-fatal)`);
        }
      }

      const totalErrorCount = deleteErrorCount + cloneErrorCount + configErrorCount;
      if (completedVmIds.length > 0) {
        setReadyVmIds(completedVmIds);
        log.step(`Done! Ready to start VMs via API: ${completedVmIds.join(', ')}`);
        if (totalErrorCount > 0) {
          log.warn(
            `Batch completed with errors: delete=${deleteErrorCount}, clone=${cloneErrorCount}, configure=${configErrorCount}`
          );
          setUiState('error');
        } else {
          setUiState('success');
        }
      } else {
        if (totalErrorCount > 0) {
          log.warn(
            `Batch completed with errors: delete=${deleteErrorCount}, clone=${cloneErrorCount}, configure=${configErrorCount}`
          );
        }
        setUiState('error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected queue processing error';
      const fallbackStatus = cancelRef.current ? 'cancelled' : 'error';
      for (const queueItem of queueRef.current) {
        if (queueItem.status === 'done' || queueItem.status === 'error') {
          continue;
        }
        log.finishTask(`vm:${queueItem.id}`, fallbackStatus, msg);
      }
      log.error(msg);
      setUiState('error');
    }

    setIsProcessing(false);
    setOperationText('');
}

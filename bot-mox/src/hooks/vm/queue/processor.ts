import type { VMHardwareConfig, VMQueueItem, VMResourceMode } from '../../../types';
import {
  cloneVM,
  deleteVM,
  pollTaskStatus,
  listVMs,
  getVMConfig,
  updateVMConfig,
  upsertBotVM,
} from '../../../services/vmService';
import { getVMSettings } from '../../../services/vmSettingsService';
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
            let taskDone = false;
            let attempts = 0;
            while (!taskDone && attempts < 240) {
              if (cancelRef.current) break;
              await sleep(1000);
              attempts++;
              try {
                const status = await pollTaskStatus(deleteResult.upid, targetNode);
                if (status.status === 'stopped') {
                  taskDone = true;
                  if (status.exitstatus && status.exitstatus !== 'OK') {
                    throw new Error(`Delete task failed: ${status.exitstatus}`);
                  }
                }
              } catch (pollErr) {
                if ((pollErr as Error).message.includes('Delete task failed')) throw pollErr;
              }
            }
            if (!taskDone) {
              throw new Error('Delete task timed out after 4 minutes');
            }
          } else {
            log.taskLog(vmTaskKey, 'Delete request returned no UPID, verifying VM removal');
          }

          let vmStillExists = true;
          for (let verifyAttempt = 0; verifyAttempt < 45; verifyAttempt++) {
            if (cancelRef.current) break;
            try {
              const vmList = await listVMs(targetNode);
              vmStillExists = vmList.some(vm => vm.vmid === vmId);
              if (!vmStillExists) break;
            } catch {
              // ignore transient list errors
            }
            await sleep(1000);
          }
          if (vmStillExists) {
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

          log.table(`Clone parameters - ${itemName}`, [
            { field: 'Template', value: String(templateVmId) },
            { field: 'New VM ID', value: String(cloneNewId) },
            { field: 'Name', value: itemName },
            { field: 'Storage', value: item.storage },
            { field: 'Format', value: item.format },
            { field: 'Full clone', value: 'Yes' },
            { field: 'Node', value: targetNode },
          ], itemName);
          log.taskLog(
            vmTaskKey,
            `Template=${templateVmId}, newid=${cloneNewId}, storage=${item.storage}, format=${item.format}`
          );

          const cloneResult = await cloneVM({
            templateVmId,
            newid: cloneNewId,
            name: itemName,
            storage: item.storage,
            format: item.format,
            full: true,
            node: targetNode,
          });

          log.debug(`UPID: ${cloneResult.upid}`, itemName);
          log.taskLog(vmTaskKey, `Clone task UPID: ${cloneResult.upid}`);

          let taskDone = false;
          let attempts = 0;
          while (!taskDone && attempts < 300) {
            if (cancelRef.current) break;
            await sleep(1000);
            attempts++;
            try {
              const status = await pollTaskStatus(cloneResult.upid, targetNode);
              if (status.status === 'stopped') {
                taskDone = true;
                if (status.exitstatus !== 'OK') {
                  throw new Error(`Clone task failed: ${status.exitstatus}`);
                }
                log.debug(`Clone task finished with status: ${status.exitstatus || 'OK'}`, item.name);
              }
            } catch (pollErr) {
              if ((pollErr as Error).message.includes('Clone task failed')) throw pollErr;
            }
          }

          if (cancelRef.current) {
            log.taskLog(vmTaskKey, 'Cancelled by user', 'warn');
            log.finishTask(vmTaskKey, 'cancelled', 'Cancelled by user');
            continue;
          }
          if (!taskDone) throw new Error('Clone timed out after 5 minutes');

          const newVmId = cloneNewId;

          let vmVisible = false;
          for (let verifyAttempt = 0; verifyAttempt < 45; verifyAttempt++) {
            if (cancelRef.current) break;
            try {
              const vmList = await listVMs(targetNode);
              if (vmList.some(vm => vm.vmid === newVmId)) {
                vmVisible = true;
                break;
              }
            } catch {
              // ignore transient list errors
            }
            await sleep(1000);
          }
          if (!vmVisible) {
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
          const patchResult = patchConfig(configText, item.name);
          generatedIp = patchResult.generatedIp;
          const vmIndex = extractVmIndex(item.name);
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
              let spoofTaskDone = false;
              let spoofAttempts = 0;
              while (!spoofTaskDone && spoofAttempts < 120) {
                if (cancelRef.current) break;
                await sleep(1000);
                spoofAttempts++;
                try {
                  const status = await pollTaskStatus(spoofTask.upid, targetNode);
                  if (status.status === 'stopped') {
                    spoofTaskDone = true;
                    if (status.exitstatus && status.exitstatus !== 'OK') {
                      throw new Error(`VM spoof config task failed: ${status.exitstatus}`);
                    }
                    log.info(`VM ${vmId}: mutable patch task finished (${status.exitstatus || 'OK'})`, item.name);
                    log.taskLog(vmTaskKey, `Mutable patch task finished (${status.exitstatus || 'OK'})`);
                  }
                } catch (pollErr) {
                  const pollMsg = pollErr instanceof Error ? pollErr.message : 'Unknown poll error';
                  log.debug(`VM ${vmId}: mutable patch poll retry (${spoofAttempts}): ${pollMsg}`, item.name);
                }
              }
              if (!spoofTaskDone) {
                throw new Error('VM spoof config task timed out after 2 minutes');
              }
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
          const modeBaseCores = resourceMode === 'project' ? projectCores : templateCores;
          const modeBaseMemory = resourceMode === 'project' ? projectMemory : templateMemory;
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
          ].join(', ');
          log.taskLog(
            vmTaskKey,
            `Resource policy: source=${resourceMode === 'project' ? 'project profile' : 'original template'}, project=${item.projectId}`
          );
          log.taskLog(
            vmTaskKey,
            `Resource resolution: template=${templateCores}/${formatMemoryWithGb(templateMemory)}, project=${projectCores}/${formatMemoryWithGb(projectMemory)}, queue=${queueOverride}`
          );
          log.taskLog(
            vmTaskKey,
            `Resource target: cores ${initialCores} -> ${cores}, memory ${formatMemoryWithGb(initialMemory)} -> ${formatMemoryWithGb(memory)}`
          );

          log.table(`Resource config - ${item.name}`, [
            { field: 'Project', value: item.projectId },
            { field: 'Mode', value: resourceMode === 'project' ? 'project profile' : 'original template' },
            { field: 'Cores', value: String(cores) },
            { field: 'Memory (MB)', value: String(memory) },
            { field: 'Other VM settings', value: 'Kept as cloned' },
          ], item.name);

          log.step(`VM ${vmId}: applying cores/memory`, item.name);
          log.taskLog(vmTaskKey, `Applying resources: cores=${cores}, memory=${memory}MB`);
          const configTask = await updateVMConfig({
            vmid: vmId,
            node: targetNode,
            cores,
            memory,
          });
          log.debug(`VM ${vmId}: cores/memory task UPID: ${configTask.upid}`, item.name);

          if (!configTask.upid || String(configTask.upid).trim() === '') {
            log.warn(`VM ${vmId}: cores/memory update returned no UPID, continuing with final config verification`, item.name);
            await sleep(1200);
          } else {
            let configTaskDone = false;
            let configAttempts = 0;
            while (!configTaskDone && configAttempts < 120) {
              if (cancelRef.current) break;
              await sleep(1000);
              configAttempts++;
              try {
                const status = await pollTaskStatus(configTask.upid, targetNode);
                if (status.status === 'stopped') {
                  configTaskDone = true;
                    if (status.exitstatus && status.exitstatus !== 'OK') {
                      throw new Error(`VM config task failed: ${status.exitstatus}`);
                    }
                    log.info(`VM ${vmId}: cores/memory task finished (${status.exitstatus || 'OK'})`, item.name);
                    log.taskLog(vmTaskKey, `Resources task finished (${status.exitstatus || 'OK'})`);
                  }
                } catch (pollErr) {
                  const pollMsg = pollErr instanceof Error ? pollErr.message : 'Unknown poll error';
                log.debug(`VM ${vmId}: cores/memory poll retry (${configAttempts}): ${pollMsg}`, item.name);
              }
            }
            if (!configTaskDone) {
              throw new Error('VM cores/memory task timed out after 2 minutes');
            }
          }
          log.taskLog(vmTaskKey, `Resources applied: cores=${cores}, memory=${memory}MB`);

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

          log.step(`VM ${vmId}: upserting Firebase record`, item.name);
          log.taskLog(vmTaskKey, 'Upserting Firebase bot record');
          log.table(`Firebase payload - ${item.name}`, [
            { field: 'UUID', value: effectiveUuid || '(missing)' },
            { field: 'Project', value: item.projectId || 'wow_tbc' },
            { field: 'Name', value: effectiveName },
            { field: 'IP', value: effectiveIp || '(empty)' },
          ], item.name);

          const firebaseResult = await upsertBotVM(
            effectiveUuid,
            effectiveName,
            effectiveIp,
            item.projectId
          );
          if (firebaseResult.mode === 'skipped') {
            log.warn('[Firebase] UUID not found, record was not written', item.name);
            log.taskLog(vmTaskKey, 'Firebase upsert skipped: UUID missing', 'warn');
          } else {
            log.info(`[Firebase] Bot record ${firebaseResult.mode}`, item.name);
            log.debug(
              `[Firebase] Bot upserted: uuid=${effectiveUuid}, project_id=${item.projectId}, name=${effectiveName}, ip=${effectiveIp}`,
              item.name
            );
            log.taskLog(vmTaskKey, `Firebase record ${firebaseResult.mode}`);
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
      log.error(msg);
      setUiState('error');
    }

    setIsProcessing(false);
    setOperationText('');
}

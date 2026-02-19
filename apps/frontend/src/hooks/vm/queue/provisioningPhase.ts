import { generateIsoPayload } from '../../../services/unattendProfileService';
import { executeVmOps } from '../../../services/vmOpsService';
import type { VMQueueItem } from '../../../types';
import type { VMLog } from '../../useVMLog';
import type { ClonedVmQueueItem } from './phaseTypes';

interface RunProvisioningIsoPhaseParams {
  completedVmIds: number[];
  clonedItems: ClonedVmQueueItem[];
  cancelRef: { current: boolean };
  queueRef: { current: VMQueueItem[] };
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
  setOperationText: (next: string) => void;
  log: VMLog;
  targetNode: string;
}

export async function runProvisioningIsoPhase(params: RunProvisioningIsoPhaseParams): Promise<{
  provisionedVmIds: number[];
  provisionErrorCount: number;
}> {
  const {
    completedVmIds,
    clonedItems,
    cancelRef,
    queueRef,
    updateQueueItem,
    setOperationText,
    log,
    targetNode,
  } = params;

  const provisionedVmIds: number[] = [];
  let provisionErrorCount = 0;

  if (completedVmIds.length === 0 || cancelRef.current) {
    return { provisionedVmIds, provisionErrorCount };
  }

  log.step('Phase 3 - Provisioning ISO');

  for (const { item, vmId } of clonedItems) {
    if (cancelRef.current) {
      log.warn('Processing cancelled by user');
      break;
    }

    const currentItem = queueRef.current.find((qi) => qi.id === item.id);
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

      const ipParts = itemIp.split('.');
      const gateway =
        ipParts.length >= 3 ? `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1` : '10.0.0.1';

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

  return { provisionedVmIds, provisionErrorCount };
}

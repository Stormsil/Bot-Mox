import { executeSshCommand } from '../ssh';
import {
  PROXMOX_ACTION_UNHANDLED,
  type ProxmoxActionContext,
  type ProxmoxActionResult,
} from './context';
import { proxmoxRequest } from './session';
import { extractUpid } from './utils';

export async function handleIsoActions(
  context: ProxmoxActionContext,
): Promise<ProxmoxActionResult> {
  const { action, payload, config, logger, node, vmid } = context;

  if (action === 'create-provision-iso') {
    if (!vmid) throw new Error('vmid required for proxmox.create-provision-iso');
    const files = payload.files as Record<string, string> | undefined;
    if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
      throw new Error('files (base64 map) required for proxmox.create-provision-iso');
    }
    const isoName = String(payload.isoName || `vm-${vmid}-provision.iso`);
    const isoStorage = String(payload.isoStorage || 'local');

    const tmpDir = `/tmp/botmox-provision-${vmid}-${Date.now()}`;
    const isoPath = `/tmp/${isoName}`;

    const writeCommands = [`mkdir -p ${tmpDir}`];
    for (const [filename, b64content] of Object.entries(files)) {
      const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
      writeCommands.push(`echo '${b64content}' | base64 -d > ${tmpDir}/${safeName}`);
    }

    writeCommands.push(
      `(command -v genisoimage >/dev/null 2>&1 && genisoimage -o ${isoPath} -J -R -V PROVISION ${tmpDir}) || ` +
        `(command -v mkisofs >/dev/null 2>&1 && mkisofs -o ${isoPath} -J -R -V PROVISION ${tmpDir}) || ` +
        '{ echo "ERROR: no ISO tool found"; exit 1; }',
    );

    const storageBasePath = isoStorage === 'local' ? '/var/lib/vz' : `/mnt/pve/${isoStorage}`;
    writeCommands.push(`mkdir -p ${storageBasePath}/template/iso`);
    writeCommands.push(`mv ${isoPath} ${storageBasePath}/template/iso/${isoName}`);
    writeCommands.push(`rm -rf ${tmpDir}`);

    const createResult = await executeSshCommand({
      command: writeCommands.join(' && '),
      payload,
      proxmoxConfig: config,
      logger,
      timeoutMs: payload.timeoutMs ?? payload.timeout_ms ?? 30_000,
      enforceAllowlist: false,
    });

    if (createResult.exitCode !== 0) {
      throw new Error(
        `ISO_CREATE_FAILED: ${createResult.stderr || 'Failed to create provision ISO'}`,
      );
    }

    return {
      isoPath: `${isoStorage}:iso/${isoName}`,
      isoName,
      created: true,
    };
  }

  if (action === 'attach-cdrom') {
    if (!vmid) throw new Error('vmid required for proxmox.attach-cdrom');
    const isoPath = String(payload.isoPath || '').trim();
    if (!isoPath) throw new Error('isoPath required for proxmox.attach-cdrom');
    const cdromSlot = String(payload.cdromSlot || 'ide2');

    const taskResult = await proxmoxRequest(
      config,
      logger,
      'PUT',
      `/api2/json/nodes/${node}/qemu/${vmid}/config`,
      {
        [cdromSlot]: `${isoPath},media=cdrom`,
      },
    );
    return { upid: extractUpid(taskResult), attached: true };
  }

  if (action === 'detach-cdrom') {
    if (!vmid) throw new Error('vmid required for proxmox.detach-cdrom');
    const cdromSlot = String(payload.cdromSlot || 'ide2');
    const deleteIso = Boolean(payload.deleteIso);

    let currentIsoPath = '';
    if (deleteIso) {
      try {
        const vmConfig = (await proxmoxRequest(
          config,
          logger,
          'GET',
          `/api2/json/nodes/${node}/qemu/${vmid}/config`,
        )) as Record<string, unknown>;
        const cdromValue = String(vmConfig[cdromSlot] || '');
        const match = cdromValue.match(/^([^,]+)/);
        if (match) currentIsoPath = match[1];
      } catch {
        // Best effort — continue with detach
      }
    }

    const taskResult = await proxmoxRequest(
      config,
      logger,
      'PUT',
      `/api2/json/nodes/${node}/qemu/${vmid}/config`,
      {
        [cdromSlot]: 'none,media=cdrom',
      },
    );

    if (deleteIso && currentIsoPath) {
      try {
        const storageMatch = currentIsoPath.match(/^([^:]+):iso\/(.+)$/);
        if (storageMatch) {
          const storage = storageMatch[1];
          const filename = storageMatch[2];
          const basePath = storage === 'local' ? '/var/lib/vz' : `/mnt/pve/${storage}`;
          await executeSshCommand({
            command: `rm -f ${basePath}/template/iso/${filename}`,
            payload,
            proxmoxConfig: config,
            logger,
            timeoutMs: 10_000,
            enforceAllowlist: false,
          });
        }
      } catch {
        // Best effort ISO cleanup
      }
    }

    return { upid: extractUpid(taskResult), detached: true };
  }

  return PROXMOX_ACTION_UNHANDLED;
}

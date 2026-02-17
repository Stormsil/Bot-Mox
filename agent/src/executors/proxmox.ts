import * as https from 'https';
import * as http from 'http';
import { ProxmoxConfig } from '../core/config-store';
import { Logger } from '../core/logger';
import { buildSshStatus, executeSshCommand, resolveSshConfig } from './ssh';

// ---------------------------------------------------------------------------
// Proxmox REST API client — ported from connectors.js
// ---------------------------------------------------------------------------

interface ProxmoxSession {
  ticket: string;
  csrf: string;
  expiresAt: number;
  baseUrl: string;
  authKey: string;
}

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

let session: ProxmoxSession | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTimeoutMs(
  value: unknown,
  fallbackMs: number,
  bounds: { min: number; max: number },
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackMs;
  }
  return Math.max(bounds.min, Math.min(bounds.max, Math.trunc(parsed)));
}

function extractUpid(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized || normalized === '[object Object]') {
      return null;
    }
    const match = normalized.match(/UPID:[^\s'"]+/i);
    return match ? match[0] : normalized;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractUpid(item, depth + 1);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates: unknown[] = [
      record.upid,
      record.UPID,
      record.task,
      record.taskId,
      record.task_id,
      record.id,
      record.value,
      record.data,
      record.result,
    ];
    for (const candidate of candidates) {
      const extracted = extractUpid(candidate, depth + 1);
      if (extracted) return extracted;
    }
    return null;
  }

  return null;
}

function normalizeVmId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.trunc(parsed) < 1) {
    throw new Error('vmid is required');
  }
  return Math.trunc(parsed);
}

function parseTaggedErrorCode(message: string): string {
  const match = String(message || '').trim().match(/^([A-Z_]+):/);
  return match ? match[1] : 'SSH_EXEC_ERROR';
}

function buildVmConfigWriteCommand(vmid: number, content: string): string {
  const normalizedContent = String(content || '');
  if (!normalizedContent.trim()) {
    throw new Error('content is required for proxmox.ssh-write-config');
  }
  let marker = `BOTMOX_VM_CONFIG_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  while (normalizedContent.includes(marker)) {
    marker = `${marker}_X`;
  }
  const body = normalizedContent.endsWith('\n') ? normalizedContent : `${normalizedContent}\n`;
  return `cat > /etc/pve/qemu-server/${vmid}.conf <<'${marker}'\n${body}${marker}`;
}

async function probeSshStatus(
  payload: Record<string, unknown>,
  config: ProxmoxConfig,
  logger: Logger,
): Promise<Record<string, unknown>> {
  const sshConfig = resolveSshConfig(payload, config);
  const status = buildSshStatus(sshConfig);

  if (!sshConfig.configured) {
    return {
      ...status,
      connected: false,
      code: 'SSH_REQUIRED',
      message: 'SSH credentials are not configured for this computer.',
    };
  }

  try {
    const probe = await executeSshCommand({
      command: 'echo BOTMOX_SSH_OK',
      payload,
      proxmoxConfig: config,
      logger,
      timeoutMs: payload.timeoutMs ?? payload.timeout_ms ?? 10_000,
      enforceAllowlist: false,
    });

    return {
      ...status,
      connected: Number(probe.exitCode) === 0,
      code: Number(probe.exitCode) === 0 ? 'OK' : 'SSH_EXEC_ERROR',
      stdout: probe.stdout,
      stderr: probe.stderr,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...status,
      connected: false,
      code: parseTaggedErrorCode(message),
      message,
    };
  }
}

function buildAuthKey(config: ProxmoxConfig): string {
  const baseUrl = String(config.url || '').replace(/\/+$/, '');
  const username = config.username.includes('@')
    ? config.username
    : `${config.username}@pam`;
  const password = String(config.password || '');
  return `${baseUrl}|${username}|${password}`;
}

// ---------------------------------------------------------------------------
// Low-level HTTP helper
// ---------------------------------------------------------------------------

function httpRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options: https.RequestOptions = {
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers,
      timeout: 30_000,
      ...(isHttps ? { agent: insecureAgent } : {}),
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          resolve({ status: res.statusCode ?? 0, data });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: raw });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (body) {
      const buf = Buffer.from(body, 'utf-8');
      req.setHeader('Content-Length', buf.byteLength);
      req.write(buf);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function login(
  config: ProxmoxConfig,
  logger: Logger,
  options?: { forceFresh?: boolean },
): Promise<ProxmoxSession> {
  const now = Date.now();
  const authKey = buildAuthKey(config);
  if (!options?.forceFresh && session && session.authKey === authKey && now < session.expiresAt) {
    return session;
  }

  const baseUrl = config.url.replace(/\/+$/, '');
  const username = config.username.includes('@')
    ? config.username
    : `${config.username}@pam`;

  logger.info(`Proxmox login to ${baseUrl} as ${username}`);

  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(config.password)}`;

  const response = await httpRequest(
    'POST',
    `${baseUrl}/api2/json/access/ticket`,
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  );

  const loginData = (response.data as { data?: { ticket?: string; CSRFPreventionToken?: string } })?.data;
  if (!loginData?.ticket) {
    const detail = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Proxmox authentication failed (HTTP ${response.status}). Possible wrong username/password.`);
    }
    throw new Error(`Proxmox login failed (HTTP ${response.status}): ${detail}`);
  }

  session = {
    ticket: loginData.ticket,
    csrf: loginData.CSRFPreventionToken || '',
    expiresAt: now + 90 * 60 * 1000,
    baseUrl,
    authKey,
  };

  logger.info('Proxmox session authenticated');
  return session;
}

// ---------------------------------------------------------------------------
// Authenticated request
// ---------------------------------------------------------------------------

async function proxmoxRequest(
  config: ProxmoxConfig,
  logger: Logger,
  method: string,
  apiPath: string,
  data?: Record<string, unknown>,
): Promise<unknown> {
  const authKey = buildAuthKey(config);
  const makeRequest = async (forceFreshLogin: boolean) => {
    const s = await login(config, logger, { forceFresh: forceFreshLogin });
    const url = `${s.baseUrl}${apiPath}`;
    const headers: Record<string, string> = {
      Cookie: `PVEAuthCookie=${s.ticket}`,
      CSRFPreventionToken: s.csrf,
    };

    let body: string | undefined;
    if (data && (method === 'POST' || method === 'PUT')) {
      body = Object.entries(data)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return httpRequest(method, url, headers, body);
  };

  let response = await makeRequest(false);

  if ((response.status === 401 || response.status === 403) && session?.authKey === authKey) {
    session = null;
    response = await makeRequest(true);
  }

  if (response.status >= 400) {
    const detail = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    throw new Error(`Proxmox API ${method} ${apiPath} failed (HTTP ${response.status}): ${detail}`);
  }

  return (response.data as { data?: unknown })?.data ?? response.data;
}

// ---------------------------------------------------------------------------
// Public executor
// ---------------------------------------------------------------------------

export async function executeProxmox(
  commandType: string,
  payload: Record<string, unknown>,
  config: ProxmoxConfig,
  logger: Logger,
): Promise<unknown> {
  const action = commandType.replace('proxmox.', '');
  const node = String(payload.node || config.node);
  const vmid = payload.vmid ? String(payload.vmid) : undefined;

  switch (action) {
    // VM power actions
    case 'start':
    case 'stop':
    case 'shutdown':
    case 'reset':
    case 'suspend':
    case 'resume': {
      if (!vmid) throw new Error(`vmid required for proxmox.${action}`);
      const taskResult = await proxmoxRequest(config, logger, 'POST',
        `/api2/json/nodes/${node}/qemu/${vmid}/status/${action}`);
      return { upid: extractUpid(taskResult) };
    }

    // Clone
    case 'clone': {
      const templateVmId = payload.templateVmId ? String(payload.templateVmId) : vmid;
      if (!templateVmId) throw new Error('vmid or templateVmId required for proxmox.clone');
      const cloneData: Record<string, unknown> = {};
      if (payload.newid) cloneData.newid = payload.newid;
      if (payload.name) cloneData.name = payload.name;
      if (payload.storage) cloneData.storage = payload.storage;
      if (payload.format) cloneData.format = payload.format;
      if (payload.full !== undefined) cloneData.full = payload.full ? 1 : 0;
      const taskResult = await proxmoxRequest(config, logger, 'POST',
        `/api2/json/nodes/${node}/qemu/${templateVmId}/clone`, cloneData);
      return { upid: extractUpid(taskResult) };
    }

    // Delete
    case 'delete': {
      if (!vmid) throw new Error('vmid required for proxmox.delete');
      const params: string[] = [];
      if (payload.purge) params.push('purge=1');
      if (payload.destroyUnreferencedDisks) params.push('destroy-unreferenced-disks=1');
      const qs = params.length ? `?${params.join('&')}` : '';
      const taskResult = await proxmoxRequest(config, logger, 'DELETE',
        `/api2/json/nodes/${node}/qemu/${vmid}${qs}`);
      return { upid: extractUpid(taskResult) };
    }

    // List VMs (frontend sends 'list-vms', curl sends 'list')
    case 'list':
    case 'list-vms':
      return proxmoxRequest(config, logger, 'GET',
        `/api2/json/nodes/${node}/qemu`);

    // Get single VM status
    case 'vm-status': {
      if (!vmid) throw new Error('vmid required for proxmox.vm-status');
      return proxmoxRequest(config, logger, 'GET',
        `/api2/json/nodes/${node}/qemu/${vmid}/status/current`);
    }

    // Get VM config
    case 'config.get':
    case 'get-config': {
      if (!vmid) throw new Error('vmid required for proxmox.get-config');
      return proxmoxRequest(config, logger, 'GET',
        `/api2/json/nodes/${node}/qemu/${vmid}/config`);
    }

    // Update VM config
    case 'config.update':
    case 'update-config': {
      if (!vmid) throw new Error('vmid required for proxmox.update-config');
      // Accept both flat params and nested config object
      const cfgData: Record<string, unknown> = {};
      const nested = (payload.config as Record<string, unknown>) ?? {};
      for (const [k, v] of Object.entries({ ...nested, ...payload })) {
        if (['vmid', 'node', 'config', 'target', 'targetId'].includes(k)) continue;
        cfgData[k] = v;
      }
      const taskResult = await proxmoxRequest(config, logger, 'PUT',
        `/api2/json/nodes/${node}/qemu/${vmid}/config`, cfgData);
      return { upid: extractUpid(taskResult) };
    }

    // Resize VM disk (increment only)
    case 'resize-disk': {
      if (!vmid) throw new Error('vmid required for proxmox.resize-disk');
      const disk = String(payload.disk || '').trim();
      const size = String(payload.size || '').trim();
      if (!disk) throw new Error('disk required for proxmox.resize-disk');
      if (!size) throw new Error('size required for proxmox.resize-disk');

      const taskResult = await proxmoxRequest(config, logger, 'PUT',
        `/api2/json/nodes/${node}/qemu/${vmid}/resize`, { disk, size });
      return { upid: extractUpid(taskResult) };
    }

    // Task status (poll Proxmox task completion)
    case 'task-status': {
      const upid = extractUpid(payload.upid ?? payload.task ?? payload.taskId);
      if (!upid) throw new Error('upid required for proxmox.task-status');
      return proxmoxRequest(config, logger, 'GET',
        `/api2/json/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`);
    }

    // Wait for task completion on agent side (reduces command-bus traffic)
    case 'wait-task': {
      const upid = extractUpid(payload.upid ?? payload.task ?? payload.taskId);
      if (!upid) throw new Error('upid required for proxmox.wait-task');
      const timeoutMs = normalizeTimeoutMs(payload.timeoutMs ?? payload.timeout_ms, 300_000, {
        min: 1_000,
        max: 1_800_000,
      });
      const intervalMs = normalizeTimeoutMs(payload.intervalMs ?? payload.interval_ms, 1_000, {
        min: 250,
        max: 15_000,
      });
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const status = await proxmoxRequest(config, logger, 'GET',
          `/api2/json/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`) as Record<string, unknown>;
        if (String(status.status || '').trim().toLowerCase() === 'stopped') {
          return status;
        }
        await sleep(intervalMs);
      }

      throw new Error(`Proxmox task ${upid} timed out after ${Math.ceil(timeoutMs / 1000)}s`);
    }

    // Wait until VM reaches desired status
    case 'wait-vm-status': {
      if (!vmid) throw new Error('vmid required for proxmox.wait-vm-status');
      const desiredStatus = String(payload.desiredStatus || payload.status || 'running').trim().toLowerCase();
      if (!desiredStatus) throw new Error('desiredStatus is required for proxmox.wait-vm-status');
      const timeoutMs = normalizeTimeoutMs(payload.timeoutMs ?? payload.timeout_ms, 120_000, {
        min: 1_000,
        max: 1_800_000,
      });
      const intervalMs = normalizeTimeoutMs(payload.intervalMs ?? payload.interval_ms, 1_000, {
        min: 250,
        max: 15_000,
      });
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const status = await proxmoxRequest(config, logger, 'GET',
          `/api2/json/nodes/${node}/qemu/${vmid}/status/current`) as Record<string, unknown>;
        if (String(status.status || '').trim().toLowerCase() === desiredStatus) {
          return status;
        }
        await sleep(intervalMs);
      }

      throw new Error(`VM ${vmid} did not reach status "${desiredStatus}" within ${Math.ceil(timeoutMs / 1000)}s`);
    }

    // Wait for VM presence/absence in node VM list
    case 'wait-vm-presence': {
      if (!vmid) throw new Error('vmid required for proxmox.wait-vm-presence');
      const shouldExist = payload.exists !== undefined ? Boolean(payload.exists) : true;
      const timeoutMs = normalizeTimeoutMs(payload.timeoutMs ?? payload.timeout_ms, 45_000, {
        min: 1_000,
        max: 600_000,
      });
      const intervalMs = normalizeTimeoutMs(payload.intervalMs ?? payload.interval_ms, 1_000, {
        min: 250,
        max: 15_000,
      });
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const vmList = await proxmoxRequest(config, logger, 'GET',
          `/api2/json/nodes/${node}/qemu`) as Array<Record<string, unknown>>;
        const exists = Array.isArray(vmList)
          && vmList.some((vm) => String(vm?.vmid || '').trim() === String(vmid));
        if (exists === shouldExist) {
          return { vmid: Number(vmid), exists };
        }
        await sleep(intervalMs);
      }

      const expected = shouldExist ? 'present' : 'absent';
      throw new Error(`VM ${vmid} did not become ${expected} within ${Math.ceil(timeoutMs / 1000)}s`);
    }

    // Send key to VM
    case 'sendkey': {
      if (!vmid) throw new Error('vmid required for proxmox.sendkey');
      const key = payload.key ? String(payload.key) : undefined;
      if (!key) throw new Error('key required for proxmox.sendkey');
      return proxmoxRequest(config, logger, 'PUT',
        `/api2/json/nodes/${node}/qemu/${vmid}/sendkey`, { key });
    }

    // Cluster resources
    case 'cluster-resources': {
      const resourceType = String(payload.type ?? payload.resourceType ?? '').trim();
      const suffix = resourceType ? `?type=${encodeURIComponent(resourceType)}` : '';
      return proxmoxRequest(config, logger, 'GET', `/api2/json/cluster/resources${suffix}`);
    }

    // SSH connection status (real SSH transport check)
    case 'ssh-status':
      return probeSshStatus(payload, config, logger);

    // Proxmox connection test / version
    case 'status': {
      const version = await proxmoxRequest(config, logger, 'GET', '/api2/json/version');
      return { connected: true, ...(version as object) };
    }

    // Backward-compatible alias for old UI checks
    case 'ssh-test': {
      return probeSshStatus(payload, config, logger);
    }

    // One-click bootstrap currently validates SSH transport (password/key mode).
    case 'ssh-bootstrap': {
      const status = await probeSshStatus(payload, config, logger);
      return {
        ...status,
        bootstrap: 'validated',
      };
    }

    // SSH read /etc/pve/qemu-server/<vmid>.conf
    case 'ssh-read-config': {
      const vmidRaw = payload.vmid ?? payload.id;
      const normalizedVmid = normalizeVmId(vmidRaw);
      const command = `cat /etc/pve/qemu-server/${normalizedVmid}.conf`;
      const result = await executeSshCommand({
        command,
        payload,
        proxmoxConfig: config,
        logger,
        timeoutMs: payload.timeoutMs ?? payload.timeout_ms ?? 15_000,
        enforceAllowlist: true,
      });
      if (result.exitCode !== 0) {
        throw new Error(`SSH_READ_FAILED: ${result.stderr || `Failed to read VM config for ${normalizedVmid}`}`);
      }
      return { config: result.stdout };
    }

    // SSH write /etc/pve/qemu-server/<vmid>.conf
    case 'ssh-write-config': {
      const vmidRaw = payload.vmid ?? payload.id;
      const normalizedVmid = normalizeVmId(vmidRaw);
      const content = String(payload.content || '');
      const command = buildVmConfigWriteCommand(normalizedVmid, content);
      const result = await executeSshCommand({
        command,
        payload,
        proxmoxConfig: config,
        logger,
        timeoutMs: payload.timeoutMs ?? payload.timeout_ms ?? 20_000,
        enforceAllowlist: false,
      });
      if (result.exitCode !== 0) {
        throw new Error(`SSH_WRITE_FAILED: ${result.stderr || `Failed to write VM config for ${normalizedVmid}`}`);
      }
      return { written: true };
    }

    // Generic SSH execution (allowlisted by default)
    case 'ssh-exec': {
      const command = String(payload.command || '').trim();
      const result = await executeSshCommand({
        command,
        payload,
        proxmoxConfig: config,
        logger,
        timeoutMs: payload.timeoutMs ?? payload.timeout ?? payload.timeout_ms ?? 30_000,
        enforceAllowlist: true,
        allowUnsafe: Boolean(payload.allowUnsafe),
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        allowlisted: true,
      };
    }

    // Login test (just verify credentials work)
    case 'login': {
      await login(config, logger, { forceFresh: Boolean(payload.force) });
      return { ok: true };
    }

    // Create provision ISO from base64-encoded file contents
    case 'create-provision-iso': {
      if (!vmid) throw new Error('vmid required for proxmox.create-provision-iso');
      const files = payload.files as Record<string, string> | undefined;
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        throw new Error('files (base64 map) required for proxmox.create-provision-iso');
      }
      const isoName = String(payload.isoName || `vm-${vmid}-provision.iso`);
      const isoStorage = String(payload.isoStorage || 'local');

      // Create temp dir, write files, generate ISO via mkisofs/genisoimage
      const tmpDir = `/tmp/botmox-provision-${vmid}-${Date.now()}`;
      const isoPath = `/tmp/${isoName}`;

      const writeCommands = [`mkdir -p ${tmpDir}`];
      for (const [filename, b64content] of Object.entries(files)) {
        const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        writeCommands.push(`echo '${b64content}' | base64 -d > ${tmpDir}/${safeName}`);
      }

      // Generate ISO with genisoimage (common on Proxmox/Debian) or mkisofs
      writeCommands.push(
        `(command -v genisoimage >/dev/null 2>&1 && genisoimage -o ${isoPath} -J -R -V PROVISION ${tmpDir}) || ` +
        `(command -v mkisofs >/dev/null 2>&1 && mkisofs -o ${isoPath} -J -R -V PROVISION ${tmpDir}) || ` +
        `{ echo "ERROR: no ISO tool found"; exit 1; }`
      );

      // Move ISO to Proxmox ISO storage
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
        throw new Error(`ISO_CREATE_FAILED: ${createResult.stderr || 'Failed to create provision ISO'}`);
      }

      return {
        isoPath: `${isoStorage}:iso/${isoName}`,
        isoName,
        created: true,
      };
    }

    // Attach CD-ROM (ISO) to VM
    case 'attach-cdrom': {
      if (!vmid) throw new Error('vmid required for proxmox.attach-cdrom');
      const isoPath = String(payload.isoPath || '').trim();
      if (!isoPath) throw new Error('isoPath required for proxmox.attach-cdrom');
      const cdromSlot = String(payload.cdromSlot || 'ide2');

      const taskResult = await proxmoxRequest(config, logger, 'PUT',
        `/api2/json/nodes/${node}/qemu/${vmid}/config`, {
          [cdromSlot]: `${isoPath},media=cdrom`,
        });
      return { upid: extractUpid(taskResult), attached: true };
    }

    // Detach CD-ROM from VM
    case 'detach-cdrom': {
      if (!vmid) throw new Error('vmid required for proxmox.detach-cdrom');
      const cdromSlot = String(payload.cdromSlot || 'ide2');
      const deleteIso = Boolean(payload.deleteIso);

      // First get current config to find ISO path for deletion
      let currentIsoPath = '';
      if (deleteIso) {
        try {
          const vmConfig = await proxmoxRequest(config, logger, 'GET',
            `/api2/json/nodes/${node}/qemu/${vmid}/config`) as Record<string, unknown>;
          const cdromValue = String(vmConfig[cdromSlot] || '');
          const match = cdromValue.match(/^([^,]+)/);
          if (match) currentIsoPath = match[1];
        } catch {
          // Best effort — continue with detach
        }
      }

      const taskResult = await proxmoxRequest(config, logger, 'PUT',
        `/api2/json/nodes/${node}/qemu/${vmid}/config`, {
          [cdromSlot]: 'none,media=cdrom',
        });

      // Delete the ISO file via SSH if requested
      if (deleteIso && currentIsoPath) {
        try {
          // Parse storage:iso/filename → filesystem path
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

    default:
      throw new Error(`Unknown proxmox action: ${action}`);
  }
}

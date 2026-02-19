const VALID_VM_ACTIONS = new Set(['start', 'stop', 'shutdown', 'reset', 'suspend', 'resume']);
const VMID_PATTERN = /^\d+$/;
const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isValidVmid(value) {
  return VMID_PATTERN.test(String(value || '').trim());
}

function parseBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return BOOLEAN_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function normalizeClonePayload(body) {
  const payload = {};

  if (body?.newid !== undefined && body?.newid !== null && body?.newid !== '') {
    payload.newid = Number(body.newid);
  }
  if (typeof body?.name === 'string' && body.name.trim()) payload.name = body.name.trim();
  if (typeof body?.storage === 'string' && body.storage.trim())
    payload.storage = body.storage.trim();
  if (typeof body?.format === 'string' && body.format.trim()) payload.format = body.format.trim();
  if (body?.full !== undefined) payload.full = body.full ? 1 : 0;

  return payload;
}

function normalizeVmConfigPayload(body) {
  const params = {};
  const handledKeys = new Set();

  const positiveIntFields = ['cores', 'sockets', 'memory'];
  for (const field of positiveIntFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') continue;

    const parsed = Number(body[field]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid ${field}`);
    }

    params[field] = Math.trunc(parsed);
    handledKeys.add(field);
  }

  if (body.balloon !== undefined && body.balloon !== null && body.balloon !== '') {
    const balloon = Number(body.balloon);
    if (!Number.isFinite(balloon) || balloon < 0) {
      throw new Error('Invalid balloon');
    }
    params.balloon = Math.trunc(balloon);
    handledKeys.add('balloon');
  }

  if (body.cpu !== undefined && body.cpu !== null && body.cpu !== '') {
    if (typeof body.cpu !== 'string') {
      throw new Error('Invalid cpu');
    }
    params.cpu = body.cpu.trim();
    handledKeys.add('cpu');
  }

  if (body.onboot !== undefined) {
    params.onboot = body.onboot ? 1 : 0;
    handledKeys.add('onboot');
  }

  if (body.agent !== undefined) {
    params.agent = body.agent ? 1 : 0;
    handledKeys.add('agent');
  }

  const dynamicStringPatterns = [
    /^args$/i,
    /^name$/i,
    /^net\d+$/i,
    /^sata\d+$/i,
    /^scsi\d+$/i,
    /^virtio\d+$/i,
    /^ide\d+$/i,
    /^efidisk\d+$/i,
    /^tpmstate\d+$/i,
    /^serial\d+$/i,
  ];

  for (const [key, value] of Object.entries(body || {})) {
    if (handledKeys.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (!dynamicStringPatterns.some((pattern) => pattern.test(key))) continue;
    if (typeof value !== 'string') {
      throw new Error(`Invalid ${key}`);
    }
    const normalized = value.trim();
    if (!normalized) continue;
    params[key] = normalized;
  }

  return params;
}

class InfraServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'InfraServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'INFRA_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function createInfraService({ proxmoxLogin, proxmoxRequest, sshExec, env, isSshCommandAllowed }) {
  if (
    typeof proxmoxLogin !== 'function' ||
    typeof proxmoxRequest !== 'function' ||
    typeof sshExec !== 'function'
  ) {
    throw new Error(
      'createInfraService requires proxmoxLogin, proxmoxRequest and sshExec functions',
    );
  }

  const allowUnsafe = Boolean(env?.sshExecAllowUnsafe);
  const isAllowed = typeof isSshCommandAllowed === 'function' ? isSshCommandAllowed : () => true;

  function ensureNode(node) {
    const normalizedNode = String(node || '').trim();
    if (!normalizedNode) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'node is required');
    }
    return normalizedNode;
  }

  function ensureVmid(vmid, message = 'Invalid vmid') {
    const normalizedVmid = String(vmid || '').trim();
    if (!isValidVmid(normalizedVmid)) {
      throw new InfraServiceError(400, 'BAD_REQUEST', message);
    }
    return normalizedVmid;
  }

  function ensureAction(action) {
    const normalizedAction = String(action || '')
      .trim()
      .toLowerCase();
    if (!VALID_VM_ACTIONS.has(normalizedAction)) {
      throw new InfraServiceError(400, 'BAD_REQUEST', `Invalid action: ${normalizedAction}`);
    }
    return normalizedAction;
  }

  function ensureKey(key) {
    const normalizedKey = typeof key === 'string' ? key.trim() : '';
    if (!normalizedKey) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'key is required');
    }
    if (!/^[A-Za-z0-9_+-]+$/.test(normalizedKey)) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'Invalid key format');
    }
    return normalizedKey;
  }

  function normalizeTimeout(timeoutMs, fallback = 30_000) {
    const parsed = Number(timeoutMs);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.trunc(parsed);
  }

  return {
    async login({ forceRefresh = true } = {}) {
      await proxmoxLogin(Boolean(forceRefresh));
      return { connected: true };
    },

    async status() {
      await proxmoxLogin();
      const result = await proxmoxRequest('get', '/api2/json/version');
      return {
        connected: true,
        version: result?.data || null,
      };
    },

    async listNodeVms({ node }) {
      const normalizedNode = ensureNode(node);
      const result = await proxmoxRequest('get', `/api2/json/nodes/${normalizedNode}/qemu`);
      return Array.isArray(result?.data) ? result.data : [];
    },

    async cloneVm({ node, vmid, body }) {
      const normalizedNode = ensureNode(node);
      const normalizedVmid = ensureVmid(vmid, 'Invalid clone target');
      const payload = normalizeClonePayload(body || {});
      const result = await proxmoxRequest(
        'post',
        `/api2/json/nodes/${normalizedNode}/qemu/${normalizedVmid}/clone`,
        payload,
      );
      return { upid: result?.data || null };
    },

    async getVmConfig({ node, vmid }) {
      const normalizedNode = ensureNode(node);
      const normalizedVmid = ensureVmid(vmid);
      const result = await proxmoxRequest(
        'get',
        `/api2/json/nodes/${normalizedNode}/qemu/${normalizedVmid}/config`,
      );
      return result?.data || {};
    },

    async updateVmConfig({ node, vmid, body }) {
      const normalizedNode = ensureNode(node);
      const normalizedVmid = ensureVmid(vmid);

      let params;
      try {
        params = normalizeVmConfigPayload(body || {});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid VM config payload';
        throw new InfraServiceError(400, 'BAD_REQUEST', message);
      }

      if (Object.keys(params).length === 0) {
        throw new InfraServiceError(400, 'BAD_REQUEST', 'No config parameters provided');
      }

      const result = await proxmoxRequest(
        'put',
        `/api2/json/nodes/${normalizedNode}/qemu/${normalizedVmid}/config`,
        params,
      );
      return { upid: result?.data || null };
    },

    async getTaskStatus({ node, upid }) {
      const normalizedNode = ensureNode(node);
      const normalizedUpid = String(upid || '').trim();
      if (!normalizedUpid) {
        throw new InfraServiceError(400, 'BAD_REQUEST', 'Invalid task id');
      }
      const result = await proxmoxRequest(
        'get',
        `/api2/json/nodes/${normalizedNode}/tasks/${encodeURIComponent(normalizedUpid)}/status`,
      );
      return result?.data || {};
    },

    async vmAction({ node, vmid, action }) {
      const normalizedNode = ensureNode(node);
      const normalizedVmid = ensureVmid(vmid);
      const normalizedAction = ensureAction(action);
      const result = await proxmoxRequest(
        'post',
        `/api2/json/nodes/${normalizedNode}/qemu/${normalizedVmid}/status/${normalizedAction}`,
      );
      return { upid: result?.data || null };
    },

    async deleteVm({ node, vmid, purge, destroyUnreferencedDisks }) {
      const normalizedNode = ensureNode(node);
      const normalizedVmid = ensureVmid(vmid);

      const normalizedPurge = parseBooleanFlag(purge, false);
      const normalizedDestroy = parseBooleanFlag(destroyUnreferencedDisks, false);
      const queryParts = [];
      if (normalizedPurge) queryParts.push('purge=1');
      if (normalizedDestroy) queryParts.push('destroy-unreferenced-disks=1');
      const querySuffix = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const result = await proxmoxRequest(
        'delete',
        `/api2/json/nodes/${normalizedNode}/qemu/${normalizedVmid}${querySuffix}`,
      );
      return { upid: result?.data || null };
    },

    async sendKey({ node, vmid, key }) {
      const normalizedNode = ensureNode(node);
      const normalizedVmid = ensureVmid(vmid);
      const normalizedKey = ensureKey(key);
      const sendKeyApiPath = `/api2/json/nodes/${normalizedNode}/qemu/${normalizedVmid}/sendkey`;

      let apiErrorMessage = '';
      for (const method of ['put', 'post']) {
        try {
          const result = await proxmoxRequest(method, sendKeyApiPath, { key: normalizedKey });
          return {
            transport: `proxmox-api-${method}`,
            upid: result?.data || null,
          };
        } catch (error) {
          apiErrorMessage = error instanceof Error ? error.message : String(error);
        }
      }

      const sshResult = await sshExec(`qm sendkey ${normalizedVmid} ${normalizedKey}`, 15_000);
      if (Number(sshResult?.exitCode ?? 1) !== 0) {
        const sshMessage = String(sshResult?.stderr || sshResult?.stdout || '').trim();
        const message = sshMessage || `qm sendkey failed with code ${sshResult?.exitCode}`;
        throw new InfraServiceError(
          500,
          'SENDKEY_FAILED',
          apiErrorMessage
            ? `Proxmox API sendkey failed (${apiErrorMessage}); SSH fallback failed (${message})`
            : `SSH fallback failed: ${message}`,
        );
      }

      return {
        transport: 'ssh-fallback',
        upid: null,
      };
    },

    async getVmCurrentStatus({ node, vmid }) {
      const normalizedNode = ensureNode(node);
      const normalizedVmid = ensureVmid(vmid);
      const result = await proxmoxRequest(
        'get',
        `/api2/json/nodes/${normalizedNode}/qemu/${normalizedVmid}/status/current`,
      );
      return result?.data || {};
    },

    async getClusterResources() {
      const result = await proxmoxRequest('get', '/api2/json/cluster/resources');
      return Array.isArray(result?.data) ? result.data : [];
    },

    async sshTest() {
      const result = await sshExec('echo "SSH connection OK"', 10_000);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },

    async execSsh({ command, timeout }) {
      const normalizedCommand = String(command || '').trim();
      if (!normalizedCommand) {
        throw new InfraServiceError(400, 'BAD_REQUEST', 'command is required');
      }

      if (!allowUnsafe && !isAllowed(normalizedCommand)) {
        throw new InfraServiceError(
          403,
          'SSH_COMMAND_FORBIDDEN',
          'Command is not allowlisted. Set SSH_EXEC_ALLOW_UNSAFE=true for emergency bypass.',
        );
      }

      const result = await sshExec(normalizedCommand, normalizeTimeout(timeout, 30_000));
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        allowlisted: isAllowed(normalizedCommand),
      };
    },

    async readVmConfig({ vmid }) {
      const normalizedVmid = ensureVmid(vmid);
      const result = await sshExec(`cat /etc/pve/qemu-server/${normalizedVmid}.conf`, 10_000);
      if (result.exitCode !== 0) {
        throw new InfraServiceError(404, 'NOT_FOUND', result.stderr || 'Config not found');
      }
      return { config: result.stdout };
    },

    async writeVmConfig({ vmid, content }) {
      const normalizedVmid = ensureVmid(vmid);
      if (typeof content !== 'string' || !content) {
        throw new InfraServiceError(400, 'BAD_REQUEST', 'content is required');
      }

      const escaped = content.replace(/'/g, "'\\''");
      const command = `echo '${escaped}' > /etc/pve/qemu-server/${normalizedVmid}.conf`;
      const result = await sshExec(command, 10_000);
      if (result.exitCode !== 0) {
        throw new InfraServiceError(500, 'WRITE_FAILED', result.stderr || 'Failed to write config');
      }
      return { written: true };
    },
  };
}

module.exports = {
  createInfraService,
  InfraServiceError,
  VALID_VM_ACTIONS,
  isValidVmid,
  normalizeVmConfigPayload,
  parseBooleanFlag,
};

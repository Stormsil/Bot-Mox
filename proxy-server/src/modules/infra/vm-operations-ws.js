const { WebSocketServer } = require('ws');
const { logger } = require('../../observability/logger');

function attachVmOperationsWebSocket({
  server,
  authorizeSocketRequest,
  proxmoxRequest,
  sshExec,
  getDefaultNode,
}) {
  const vmOpsWssLegacy = new WebSocketServer({ server, path: '/ws/vm-operations' });
  const vmOpsWssV1 = new WebSocketServer({ server, path: '/ws/v1/vm-operations' });

  async function processQueue({ ws, items, templateVmId, node }) {
    if (!Array.isArray(items) || items.length === 0) {
      ws.send(JSON.stringify({ type: 'error', message: 'No items in queue' }));
      return;
    }

    const targetNode = node || (typeof getDefaultNode === 'function' ? getDefaultNode() : null) || 'h1';
    const total = items.length;

    for (let i = 0; i < total; i++) {
      const item = items[i];
      const vmName = item.name;

      try {
        ws.send(JSON.stringify({
          type: 'progress',
          step: i + 1,
          total,
          vmName,
          message: `Cloning ${vmName}...`,
          level: 'info',
        }));

        const cloneParams = { name: vmName, full: 1 };
        if (item.storage) cloneParams.storage = item.storage;
        if (item.format) cloneParams.format = item.format;

        const cloneResult = await proxmoxRequest(
          'post',
          `/api2/json/nodes/${targetNode}/qemu/${templateVmId || 100}/clone`,
          cloneParams
        );
        const upid = cloneResult.data;

        ws.send(JSON.stringify({
          type: 'log',
          vmName,
          level: 'info',
          message: `Clone started, UPID: ${upid}`,
        }));

        let taskDone = false;
        let attempts = 0;
        while (!taskDone && attempts < 300) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
          try {
            const statusResult = await proxmoxRequest(
              'get',
              `/api2/json/nodes/${targetNode}/tasks/${encodeURIComponent(upid)}/status`
            );
            const status = statusResult.data;
            if (status.status === 'stopped') {
              taskDone = true;
              if (status.exitstatus !== 'OK') {
                throw new Error(`Clone task failed: ${status.exitstatus}`);
              }
            }
          } catch (pollError) {
            if (pollError.message.includes('Clone task failed')) throw pollError;
          }
        }

        if (!taskDone) {
          throw new Error('Clone timed out after 5 minutes');
        }

        ws.send(JSON.stringify({
          type: 'log',
          vmName,
          level: 'info',
          message: 'Clone complete. Finding VM ID...',
        }));

        const vmList = await proxmoxRequest('get', `/api2/json/nodes/${targetNode}/qemu`);
        const newVm = vmList.data.find((vm) => vm.name === vmName);
        if (!newVm) {
          throw new Error(`Could not find cloned VM with name "${vmName}"`);
        }
        const newVmId = newVm.vmid;

        ws.send(JSON.stringify({
          type: 'log',
          vmName,
          level: 'info',
          message: `Found VM ID: ${newVmId}. Reading config...`,
        }));

        const configResult = await sshExec(`cat /etc/pve/qemu-server/${newVmId}.conf`, 10000);
        if (configResult.exitCode !== 0) {
          throw new Error(`Failed to read config: ${configResult.stderr}`);
        }

        ws.send(JSON.stringify({
          type: 'config-ready',
          vmName,
          vmId: newVmId,
          config: configResult.stdout,
          step: i + 1,
          total,
        }));
      } catch (itemError) {
        ws.send(JSON.stringify({
          type: 'error',
          vmName,
          step: i + 1,
          total,
          message: itemError.message,
        }));
      }
    }

    ws.send(JSON.stringify({ type: 'complete', total }));
  }

  async function writeConfig({ ws, vmId, config, vmName }) {
    try {
      const escaped = config.replace(/'/g, "'\\''");
      const command = `echo '${escaped}' > /etc/pve/qemu-server/${vmId}.conf`;
      const result = await sshExec(command, 10000);
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || 'Failed to write config');
      }
      ws.send(JSON.stringify({
        type: 'config-written',
        vmName,
        vmId,
        message: 'Config patched and written successfully',
      }));
    } catch (writeError) {
      ws.send(JSON.stringify({
        type: 'error',
        vmName,
        vmId,
        message: `Write failed: ${writeError.message}`,
      }));
    }
  }

  async function onVmOperationsConnection(ws, req) {
    if (typeof authorizeSocketRequest === 'function') {
      try {
        const authResult = await authorizeSocketRequest(req);
        if (!authResult?.ok) {
          ws.send(JSON.stringify({
            type: 'error',
            message: authResult?.payload?.error?.message || 'Unauthorized',
            code: authResult?.payload?.error?.code || 'UNAUTHORIZED',
          }));
          ws.close(4001, 'Unauthorized');
          return;
        }
      } catch (_error) {
        ws.close(4001, 'Unauthorized');
        return;
      }
    }

    logger.info('WebSocket client connected to VM operations channel');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (data.type === 'process-queue') {
          await processQueue({ ws, ...data });
        }

        if (data.type === 'write-config') {
          await writeConfig({ ws, ...data });
        }
      } catch (_parseError) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  }

  vmOpsWssLegacy.on('connection', (ws, req) => {
    void onVmOperationsConnection(ws, req);
  });
  vmOpsWssV1.on('connection', (ws, req) => {
    void onVmOperationsConnection(ws, req);
  });

  return {
    legacyServer: vmOpsWssLegacy,
    v1Server: vmOpsWssV1,
  };
}

module.exports = {
  attachVmOperationsWebSocket,
};

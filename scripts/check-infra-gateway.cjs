#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const express = require('express');

const REPO_ROOT = path.resolve(__dirname, '..');

function buildBackend() {
  const command = 'corepack pnpm --filter @botmox/backend build';
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
          cwd: REPO_ROOT,
          stdio: 'inherit',
        })
      : spawnSync('sh', ['-lc', command], {
          cwd: REPO_ROOT,
          stdio: 'inherit',
        });

  if (result.status !== 0) {
    throw new Error(
      `Failed to build @botmox/backend before infra-gateway checks (status=${String(result.status)}, signal=${String(result.signal)}, error=${String(result.error)})`,
    );
  }
}

function listenOnRandomPort(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve listening address'));
        return;
      }
      resolve(address.port);
    });
  });
}

async function startUpstream(name) {
  const httpHits = [];
  const wsHits = [];

  const server = http.createServer((req, res) => {
    const requestUrl = String(req.url || '/');
    httpHits.push({
      method: String(req.method || 'GET').toUpperCase(),
      url: requestUrl,
      headers: req.headers,
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        success: true,
        service: name,
        url: requestUrl,
        method: String(req.method || 'GET').toUpperCase(),
      }),
    );
  });

  server.on('upgrade', (req, socket) => {
    wsHits.push({
      url: String(req.url || '/'),
      headers: req.headers,
    });

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        '\r\n',
    );
    socket.end();
  });

  const port = await listenOnRandomPort(server);
  return {
    name,
    server,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    httpHits,
    wsHits,
  };
}

function fetchJson(url, init = {}) {
  return fetch(url, init).then(async (response) => {
    const text = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    return {
      status: response.status,
      text,
      payload,
    };
  });
}

function wsHandshake({ port, pathName, headers = {} }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    let buffer = '';

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      reject(new Error(`WebSocket handshake timeout for ${pathName}`));
    }, 5000);

    socket.once('connect', () => {
      const lines = [
        `GET ${pathName} HTTP/1.1`,
        `Host: 127.0.0.1:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      ];

      for (const [key, value] of Object.entries(headers)) {
        lines.push(`${key}: ${value}`);
      }

      lines.push('\r\n');
      socket.write(lines.join('\r\n'));
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (settled || !buffer.includes('\r\n\r\n')) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      const [head] = buffer.split('\r\n\r\n');
      const lines = head.split('\r\n');
      socket.end();
      resolve({
        statusLine: lines[0] || '',
        rawHead: head,
      });
    });

    socket.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    socket.on('end', () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const [head] = buffer.split('\r\n\r\n');
      const lines = head.split('\r\n');
      resolve({
        statusLine: lines[0] || '',
        rawHead: head,
      });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server || typeof server.close !== 'function') {
      resolve();
      return;
    }
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => resolve());
  });
}

async function main() {
  buildBackend();

  const proxmox = await startUpstream('proxmox');
  const tinyfm = await startUpstream('tinyfm');
  const syncthing = await startUpstream('syncthing');

  process.env.PROXMOX_URL = proxmox.baseUrl;
  process.env.TINYFM_URL = `${tinyfm.baseUrl}/index.php?p=`;
  process.env.SYNCTHING_URL = `${syncthing.baseUrl}/`;

  const {
    InfraGatewayService,
  } = require('../apps/backend/dist/modules/infra-gateway/infra-gateway.service.js');
  const {
    InfraGatewayMiddleware,
  } = require('../apps/backend/dist/modules/infra-gateway/infra-gateway.middleware.js');
  const {
    attachInfraGatewayUpgradeHandler,
  } = require('../apps/backend/dist/modules/infra-gateway/infra-gateway.upgrade.js');

  const gatewayService = new InfraGatewayService();
  const gatewayMiddleware = new InfraGatewayMiddleware(gatewayService);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    void gatewayMiddleware.use(req, res, next).catch(next);
  });
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    });
  });

  const backendServer = http.createServer(app);
  attachInfraGatewayUpgradeHandler({
    server: backendServer,
    gatewayService,
  });
  const backendPort = await listenOnRandomPort(backendServer);
  const backendBaseUrl = `http://127.0.0.1:${backendPort}`;

  try {
    const unauthorized = await fetchJson(`${backendBaseUrl}/proxmox-ui/ui/index.html`);
    assert.equal(unauthorized.status, 401, 'Expected 401 for unauthorized UI proxy request');

    const authHeaders = {
      Authorization: 'Bearer test-token',
    };

    const proxmoxUi = await fetchJson(`${backendBaseUrl}/proxmox-ui/ui/index.html`, {
      headers: authHeaders,
    });
    assert.equal(proxmoxUi.status, 200, 'Expected proxmox-ui proxy status 200');
    assert.equal(proxmoxUi.payload?.service, 'proxmox');
    assert.equal(proxmoxUi.payload?.url, '/ui/index.html');

    const proxmoxApi2 = await fetchJson(`${backendBaseUrl}/api2/json/version?full=1`, {
      headers: authHeaders,
    });
    assert.equal(proxmoxApi2.status, 200, 'Expected /api2 proxy status 200');
    assert.equal(proxmoxApi2.payload?.service, 'proxmox');
    assert.equal(proxmoxApi2.payload?.url, '/api2/json/version?full=1');

    const tinyfmUi = await fetchJson(`${backendBaseUrl}/tinyfm-ui`, {
      headers: authHeaders,
    });
    assert.equal(tinyfmUi.status, 200, 'Expected tinyfm-ui proxy status 200');
    assert.equal(tinyfmUi.payload?.service, 'tinyfm');
    assert.equal(tinyfmUi.payload?.url, '/index.php?p=');

    const syncthingUi = await fetchJson(`${backendBaseUrl}/syncthing-ui/rest/system/ping`, {
      headers: authHeaders,
    });
    assert.equal(syncthingUi.status, 200, 'Expected syncthing-ui proxy status 200');
    assert.equal(syncthingUi.payload?.service, 'syncthing');
    assert.equal(syncthingUi.payload?.url, '/rest/system/ping');

    const wsUnauthorized = await wsHandshake({
      port: backendPort,
      pathName: '/proxmox-ui/ws',
    });
    assert.match(
      wsUnauthorized.statusLine,
      /^HTTP\/1\.1 401 /,
      'Expected unauthorized websocket handshake to return 401',
    );

    const wsProxmox = await wsHandshake({
      port: backendPort,
      pathName: '/proxmox-ui/ws',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });
    assert.match(
      wsProxmox.statusLine,
      /^HTTP\/1\.1 101 /,
      'Expected proxmox websocket handshake to return 101',
    );
    assert.ok(
      proxmox.wsHits.some((entry) => entry.url === '/proxmox-ui/ws'),
      'Expected proxmox upstream websocket hit',
    );

    const wsTinyHint = await wsHandshake({
      port: backendPort,
      pathName: '/rest/events',
      headers: {
        Authorization: 'Bearer test-token',
        Referer: `${backendBaseUrl}/tinyfm-ui/`,
        Origin: backendBaseUrl,
      },
    });
    assert.match(
      wsTinyHint.statusLine,
      /^HTTP\/1\.1 101 /,
      'Expected tinyfm hinted websocket handshake to return 101',
    );
    assert.ok(
      tinyfm.wsHits.some((entry) => String(entry.url || '').includes('/rest/events')),
      'Expected tinyfm upstream websocket hit via hint fallback',
    );

    process.stdout.write('Infra gateway check passed (HTTP + WS).\n');
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await closeServer(backendServer);
    await closeServer(proxmox.server);
    await closeServer(tinyfm.server);
    await closeServer(syncthing.server);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});

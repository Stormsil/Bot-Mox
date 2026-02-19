#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const express = require('express');
const { createNestStranglerMiddleware } = require('../proxy-server/src/bootstrap/nest-strangler');

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    return await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return {
    status: response.status,
    payload,
  };
}

function createNestTargetApp() {
  const app = express();

  app.use('/api/v1/settings/api_keys', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'nest',
      },
    });
  });

  app.post('/api/v1/license/lease', (_req, res) => {
    res.status(201).json({
      success: true,
      data: {
        source: 'nest',
      },
    });
  });

  app.get('/api/v1/bots', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'bot-1',
          source: 'nest',
        },
      ],
    });
  });

  app.get('/api/v1/theme-assets', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'nest',
      },
    });
  });

  app.get('/api/v1/ipqs/status', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'nest',
      },
    });
  });

  app.get('/api/v1/workspace/notes', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'note-1',
          source: 'nest',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/auth/whoami', (_req, res) => {
    res.json({
      success: true,
      data: {
        id: 'user-1',
        source: 'nest',
      },
    });
  });

  app.get('/api/v1/agents', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'agent-1',
          source: 'nest',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/resources/licenses', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'license-1',
          source: 'nest',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/finance/operations', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'op-1',
          source: 'nest',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/playbooks', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'playbook-1',
          source: 'nest',
        },
      ],
    });
  });

  app.get('/api/v1/vm-ops/commands', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'cmd-1',
          source: 'nest',
        },
      ],
    });
  });

  app.get('/api/v1/wow-names', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'nest',
        names: ['Aldor'],
      },
    });
  });

  app.post('/api/v1/provisioning/validate-token', (_req, res) => {
    res.json({
      success: true,
      data: {
        valid: true,
        source: 'nest',
      },
    });
  });

  app.get('/api/v1/unattend-profiles', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'profile-1',
          source: 'nest',
        },
      ],
    });
  });

  app.post('/api/v1/provisioning/generate-iso-payload', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'nest',
      },
    });
  });

  app.post('/api/v1/provisioning/report-progress', (_req, res) => {
    res.json({
      success: true,
      data: {
        vm_uuid: 'vm-1',
        step: 'bootstrap',
        status: 'running',
        source: 'nest',
      },
    });
  });

  app.get('/api/v1/provisioning/progress/:vmUuid', (_req, res) => {
    res.json({
      success: true,
      data: {
        vm_uuid: 'vm-1',
        source: 'nest',
      },
    });
  });

  app.use('/api/v1', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Nest route not found',
      },
    });
  });

  return app;
}

function createLegacyApp(env) {
  const app = express();

  const logger = {
    info() {},
    warn() {},
    error() {},
  };

  app.use(express.json());
  app.use(
    '/api/v1',
    createNestStranglerMiddleware({
      env,
      logger,
    }),
  );

  app.get('/api/v1/settings/api_keys', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'legacy',
      },
    });
  });

  app.post('/api/v1/license/lease', (_req, res) => {
    res.status(201).json({
      success: true,
      data: {
        source: 'legacy',
      },
    });
  });

  app.get('/api/v1/bots', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'bot-1',
          source: 'legacy',
        },
      ],
    });
  });

  app.get('/api/v1/theme-assets', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'legacy',
      },
    });
  });

  app.get('/api/v1/ipqs/status', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'legacy',
      },
    });
  });

  app.get('/api/v1/workspace/notes', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'note-1',
          source: 'legacy',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/auth/whoami', (_req, res) => {
    res.json({
      success: true,
      data: {
        id: 'user-1',
        source: 'legacy',
      },
    });
  });

  app.get('/api/v1/agents', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'agent-1',
          source: 'legacy',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/resources/licenses', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'license-1',
          source: 'legacy',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/finance/operations', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'op-1',
          source: 'legacy',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
  });

  app.get('/api/v1/playbooks', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'playbook-1',
          source: 'legacy',
        },
      ],
    });
  });

  app.get('/api/v1/vm-ops/commands', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'cmd-1',
          source: 'legacy',
        },
      ],
    });
  });

  app.get('/api/v1/wow-names', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'legacy',
        names: ['Aldor'],
      },
    });
  });

  app.post('/api/v1/provisioning/validate-token', (_req, res) => {
    res.json({
      success: true,
      data: {
        valid: true,
        source: 'legacy',
      },
    });
  });

  app.get('/api/v1/unattend-profiles', (_req, res) => {
    res.json({
      success: true,
      data: [
        {
          id: 'profile-1',
          source: 'legacy',
        },
      ],
    });
  });

  app.post('/api/v1/provisioning/generate-iso-payload', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'legacy',
      },
    });
  });

  app.post('/api/v1/provisioning/report-progress', (_req, res) => {
    res.json({
      success: true,
      data: {
        vm_uuid: 'vm-1',
        step: 'bootstrap',
        status: 'running',
        source: 'legacy',
      },
    });
  });

  app.get('/api/v1/provisioning/progress/:vmUuid', (_req, res) => {
    res.json({
      success: true,
      data: {
        vm_uuid: 'vm-1',
        source: 'legacy',
      },
    });
  });

  app.get('/api/v1/health/ready', (_req, res) => {
    res.json({
      success: true,
      data: {
        source: 'legacy',
      },
    });
  });

  app.use('/api/v1', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Legacy route not found',
      },
    });
  });

  return app;
}

async function checkProxyAndFallback() {
  const nestApp = createNestTargetApp();

  await withServer(nestApp, async (nestBaseUrl) => {
    const stranglerEnv = {
      stranglerNestUrl: nestBaseUrl,
      stranglerModules: [
        'settings',
        'license',
        'bots',
        'theme-assets',
        'ipqs',
        'workspace',
        'auth',
        'agents',
        'resources',
        'finance',
        'playbooks',
        'vm-ops',
        'wow-names',
        'provisioning',
      ],
      stranglerFallbackToLegacy: true,
      stranglerTimeoutMs: 1000,
    };
    const legacyApp = createLegacyApp(stranglerEnv);

    await withServer(legacyApp, async (legacyBaseUrl) => {
      const proxied = await requestJson(legacyBaseUrl, '/api/v1/settings/api_keys');
      assert.equal(proxied.status, 200, 'Expected proxied settings status=200');
      assert.equal(
        proxied.payload?.data?.source,
        'nest',
        'Expected settings request to be proxied to nest',
      );

      const bypassed = await requestJson(legacyBaseUrl, '/api/v1/health/ready');
      assert.equal(bypassed.status, 200, 'Expected health status=200');
      assert.equal(
        bypassed.payload?.data?.source,
        'legacy',
        'Expected non-selected module request to stay on legacy',
      );

      const proxiedLicenseLease = await requestJson(legacyBaseUrl, '/api/v1/license/lease', {
        method: 'POST',
        body: {},
      });
      assert.equal(proxiedLicenseLease.status, 201, 'Expected proxied license lease status=201');
      assert.equal(
        proxiedLicenseLease.payload?.data?.source,
        'nest',
        'Expected license lease request to be proxied to nest',
      );

      const proxiedBots = await requestJson(legacyBaseUrl, '/api/v1/bots');
      assert.equal(proxiedBots.status, 200, 'Expected proxied bots status=200');
      assert.equal(
        proxiedBots.payload?.data?.[0]?.source,
        'nest',
        'Expected bots request to be proxied to nest',
      );

      const proxiedThemeAssets = await requestJson(legacyBaseUrl, '/api/v1/theme-assets');
      assert.equal(proxiedThemeAssets.status, 200, 'Expected proxied theme-assets status=200');
      assert.equal(
        proxiedThemeAssets.payload?.data?.source,
        'nest',
        'Expected theme-assets request to be proxied to nest',
      );

      const proxiedIpqs = await requestJson(legacyBaseUrl, '/api/v1/ipqs/status');
      assert.equal(proxiedIpqs.status, 200, 'Expected proxied ipqs status=200');
      assert.equal(
        proxiedIpqs.payload?.data?.source,
        'nest',
        'Expected ipqs request to be proxied to nest',
      );

      const proxiedWorkspaceNotes = await requestJson(legacyBaseUrl, '/api/v1/workspace/notes');
      assert.equal(proxiedWorkspaceNotes.status, 200, 'Expected proxied workspace status=200');
      assert.equal(
        proxiedWorkspaceNotes.payload?.data?.[0]?.source,
        'nest',
        'Expected workspace request to be proxied to nest',
      );

      const proxiedWhoami = await requestJson(legacyBaseUrl, '/api/v1/auth/whoami');
      assert.equal(proxiedWhoami.status, 200, 'Expected proxied auth status=200');
      assert.equal(
        proxiedWhoami.payload?.data?.source,
        'nest',
        'Expected auth request to be proxied to nest',
      );

      const proxiedAgents = await requestJson(legacyBaseUrl, '/api/v1/agents');
      assert.equal(proxiedAgents.status, 200, 'Expected proxied agents status=200');
      assert.equal(
        proxiedAgents.payload?.data?.[0]?.source,
        'nest',
        'Expected agents request to be proxied to nest',
      );

      const proxiedResources = await requestJson(legacyBaseUrl, '/api/v1/resources/licenses');
      assert.equal(proxiedResources.status, 200, 'Expected proxied resources status=200');
      assert.equal(
        proxiedResources.payload?.data?.[0]?.source,
        'nest',
        'Expected resources request to be proxied to nest',
      );

      const proxiedFinance = await requestJson(legacyBaseUrl, '/api/v1/finance/operations');
      assert.equal(proxiedFinance.status, 200, 'Expected proxied finance status=200');
      assert.equal(
        proxiedFinance.payload?.data?.[0]?.source,
        'nest',
        'Expected finance request to be proxied to nest',
      );

      const proxiedPlaybooks = await requestJson(legacyBaseUrl, '/api/v1/playbooks');
      assert.equal(proxiedPlaybooks.status, 200, 'Expected proxied playbooks status=200');
      assert.equal(
        proxiedPlaybooks.payload?.data?.[0]?.source,
        'nest',
        'Expected playbooks request to be proxied to nest',
      );

      const proxiedVmOps = await requestJson(legacyBaseUrl, '/api/v1/vm-ops/commands');
      assert.equal(proxiedVmOps.status, 200, 'Expected proxied vm-ops status=200');
      assert.equal(
        proxiedVmOps.payload?.data?.[0]?.source,
        'nest',
        'Expected vm-ops request to be proxied to nest',
      );

      const proxiedWowNames = await requestJson(legacyBaseUrl, '/api/v1/wow-names');
      assert.equal(proxiedWowNames.status, 200, 'Expected proxied wow-names status=200');
      assert.equal(
        proxiedWowNames.payload?.data?.source,
        'nest',
        'Expected wow-names request to be proxied to nest',
      );

      const proxiedProvisioning = await requestJson(
        legacyBaseUrl,
        '/api/v1/provisioning/validate-token',
        {
          method: 'POST',
          body: { token: 'token-ok', vm_uuid: 'vm-1' },
        },
      );
      assert.equal(proxiedProvisioning.status, 200, 'Expected proxied provisioning status=200');
      assert.equal(
        proxiedProvisioning.payload?.data?.source,
        'nest',
        'Expected provisioning request to be proxied to nest',
      );

      const proxiedUnattendProfiles = await requestJson(legacyBaseUrl, '/api/v1/unattend-profiles');
      assert.equal(
        proxiedUnattendProfiles.status,
        200,
        'Expected proxied unattend-profiles status=200',
      );
      assert.equal(
        proxiedUnattendProfiles.payload?.data?.[0]?.source,
        'nest',
        'Expected unattend-profiles request to be proxied to nest',
      );

      const proxiedGenerateIsoPayload = await requestJson(
        legacyBaseUrl,
        '/api/v1/provisioning/generate-iso-payload',
        {
          method: 'POST',
          body: { vm_uuid: 'vm-1' },
        },
      );
      assert.equal(
        proxiedGenerateIsoPayload.status,
        200,
        'Expected proxied provisioning generate-iso-payload status=200',
      );
      assert.equal(
        proxiedGenerateIsoPayload.payload?.data?.source,
        'nest',
        'Expected provisioning generate-iso-payload request to be proxied to nest',
      );

      const proxiedProvisioningReport = await requestJson(
        legacyBaseUrl,
        '/api/v1/provisioning/report-progress',
        {
          method: 'POST',
          body: { token: 'token-ok', vm_uuid: 'vm-1', step: 'bootstrap', status: 'running' },
        },
      );
      assert.equal(
        proxiedProvisioningReport.status,
        200,
        'Expected proxied provisioning report-progress status=200',
      );
      assert.equal(
        proxiedProvisioningReport.payload?.data?.source,
        'nest',
        'Expected provisioning report-progress request to be proxied to nest',
      );

      const proxiedProvisioningProgress = await requestJson(
        legacyBaseUrl,
        '/api/v1/provisioning/progress/vm-1',
      );
      assert.equal(
        proxiedProvisioningProgress.status,
        200,
        'Expected proxied provisioning progress status=200',
      );
      assert.equal(
        proxiedProvisioningProgress.payload?.data?.source,
        'nest',
        'Expected provisioning progress request to be proxied to nest',
      );
    });
  });

  const fallbackEnv = {
    stranglerNestUrl: 'http://127.0.0.1:65534',
    stranglerModules: [
      'settings',
      'license',
      'bots',
      'theme-assets',
      'ipqs',
      'workspace',
      'auth',
      'agents',
      'resources',
      'finance',
      'playbooks',
      'vm-ops',
      'wow-names',
      'provisioning',
    ],
    stranglerFallbackToLegacy: true,
    stranglerTimeoutMs: 300,
  };
  const fallbackApp = createLegacyApp(fallbackEnv);

  await withServer(fallbackApp, async (baseUrl) => {
    const fallback = await requestJson(baseUrl, '/api/v1/settings/api_keys');
    assert.equal(fallback.status, 200, 'Expected fallback status=200');
    assert.equal(
      fallback.payload?.data?.source,
      'legacy',
      'Expected fallback to legacy when nest is unavailable',
    );

    const licenseFallback = await requestJson(baseUrl, '/api/v1/license/lease', {
      method: 'POST',
      body: {},
    });
    assert.equal(licenseFallback.status, 201, 'Expected license fallback status=201');
    assert.equal(
      licenseFallback.payload?.data?.source,
      'legacy',
      'Expected license module to fallback to legacy when nest is unavailable',
    );

    const botsFallback = await requestJson(baseUrl, '/api/v1/bots');
    assert.equal(botsFallback.status, 200, 'Expected bots fallback status=200');
    assert.equal(
      botsFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected bots module to fallback to legacy when nest is unavailable',
    );

    const themeAssetsFallback = await requestJson(baseUrl, '/api/v1/theme-assets');
    assert.equal(themeAssetsFallback.status, 200, 'Expected theme-assets fallback status=200');
    assert.equal(
      themeAssetsFallback.payload?.data?.source,
      'legacy',
      'Expected theme-assets module to fallback to legacy when nest is unavailable',
    );

    const ipqsFallback = await requestJson(baseUrl, '/api/v1/ipqs/status');
    assert.equal(ipqsFallback.status, 200, 'Expected ipqs fallback status=200');
    assert.equal(
      ipqsFallback.payload?.data?.source,
      'legacy',
      'Expected ipqs module to fallback to legacy when nest is unavailable',
    );

    const workspaceFallback = await requestJson(baseUrl, '/api/v1/workspace/notes');
    assert.equal(workspaceFallback.status, 200, 'Expected workspace fallback status=200');
    assert.equal(
      workspaceFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected workspace module to fallback to legacy when nest is unavailable',
    );

    const authFallback = await requestJson(baseUrl, '/api/v1/auth/whoami');
    assert.equal(authFallback.status, 200, 'Expected auth fallback status=200');
    assert.equal(
      authFallback.payload?.data?.source,
      'legacy',
      'Expected auth module to fallback to legacy when nest is unavailable',
    );

    const agentsFallback = await requestJson(baseUrl, '/api/v1/agents');
    assert.equal(agentsFallback.status, 200, 'Expected agents fallback status=200');
    assert.equal(
      agentsFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected agents module to fallback to legacy when nest is unavailable',
    );

    const resourcesFallback = await requestJson(baseUrl, '/api/v1/resources/licenses');
    assert.equal(resourcesFallback.status, 200, 'Expected resources fallback status=200');
    assert.equal(
      resourcesFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected resources module to fallback to legacy when nest is unavailable',
    );

    const financeFallback = await requestJson(baseUrl, '/api/v1/finance/operations');
    assert.equal(financeFallback.status, 200, 'Expected finance fallback status=200');
    assert.equal(
      financeFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected finance module to fallback to legacy when nest is unavailable',
    );

    const playbooksFallback = await requestJson(baseUrl, '/api/v1/playbooks');
    assert.equal(playbooksFallback.status, 200, 'Expected playbooks fallback status=200');
    assert.equal(
      playbooksFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected playbooks module to fallback to legacy when nest is unavailable',
    );

    const vmOpsFallback = await requestJson(baseUrl, '/api/v1/vm-ops/commands');
    assert.equal(vmOpsFallback.status, 200, 'Expected vm-ops fallback status=200');
    assert.equal(
      vmOpsFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected vm-ops module to fallback to legacy when nest is unavailable',
    );

    const wowNamesFallback = await requestJson(baseUrl, '/api/v1/wow-names');
    assert.equal(wowNamesFallback.status, 200, 'Expected wow-names fallback status=200');
    assert.equal(
      wowNamesFallback.payload?.data?.source,
      'legacy',
      'Expected wow-names module to fallback to legacy when nest is unavailable',
    );

    const provisioningFallback = await requestJson(baseUrl, '/api/v1/provisioning/validate-token', {
      method: 'POST',
      body: { token: 'token-ok', vm_uuid: 'vm-1' },
    });
    assert.equal(provisioningFallback.status, 200, 'Expected provisioning fallback status=200');
    assert.equal(
      provisioningFallback.payload?.data?.source,
      'legacy',
      'Expected provisioning module to fallback to legacy when nest is unavailable',
    );

    const unattendProfilesFallback = await requestJson(baseUrl, '/api/v1/unattend-profiles');
    assert.equal(
      unattendProfilesFallback.status,
      200,
      'Expected unattend-profiles fallback status=200',
    );
    assert.equal(
      unattendProfilesFallback.payload?.data?.[0]?.source,
      'legacy',
      'Expected unattend-profiles module to fallback to legacy when nest is unavailable',
    );

    const generateIsoPayloadFallback = await requestJson(
      baseUrl,
      '/api/v1/provisioning/generate-iso-payload',
      {
        method: 'POST',
        body: { vm_uuid: 'vm-1' },
      },
    );
    assert.equal(
      generateIsoPayloadFallback.status,
      200,
      'Expected generate-iso-payload fallback status=200',
    );
    assert.equal(
      generateIsoPayloadFallback.payload?.data?.source,
      'legacy',
      'Expected generate-iso-payload module to fallback to legacy when nest is unavailable',
    );

    const provisioningReportFallback = await requestJson(
      baseUrl,
      '/api/v1/provisioning/report-progress',
      {
        method: 'POST',
        body: { token: 'token-ok', vm_uuid: 'vm-1', step: 'bootstrap', status: 'running' },
      },
    );
    assert.equal(
      provisioningReportFallback.status,
      200,
      'Expected provisioning report-progress fallback status=200',
    );
    assert.equal(
      provisioningReportFallback.payload?.data?.source,
      'legacy',
      'Expected provisioning report-progress module to fallback to legacy when nest is unavailable',
    );

    const provisioningProgressFallback = await requestJson(
      baseUrl,
      '/api/v1/provisioning/progress/vm-1',
    );
    assert.equal(
      provisioningProgressFallback.status,
      200,
      'Expected provisioning progress fallback status=200',
    );
    assert.equal(
      provisioningProgressFallback.payload?.data?.source,
      'legacy',
      'Expected provisioning progress module to fallback to legacy when nest is unavailable',
    );
  });

  const noFallbackEnv = {
    stranglerNestUrl: 'http://127.0.0.1:65534',
    stranglerModules: [
      'settings',
      'license',
      'bots',
      'theme-assets',
      'ipqs',
      'workspace',
      'auth',
      'agents',
      'resources',
      'finance',
      'playbooks',
      'vm-ops',
      'wow-names',
      'provisioning',
    ],
    stranglerFallbackToLegacy: false,
    stranglerTimeoutMs: 300,
  };
  const noFallbackApp = createLegacyApp(noFallbackEnv);

  await withServer(noFallbackApp, async (baseUrl) => {
    const noFallback = await requestJson(baseUrl, '/api/v1/settings/api_keys');
    assert.equal(noFallback.status, 502, 'Expected 502 when fallback is disabled');
    assert.equal(
      noFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected strangler proxy error code',
    );

    const licenseNoFallback = await requestJson(baseUrl, '/api/v1/license/lease', {
      method: 'POST',
      body: {},
    });
    assert.equal(
      licenseNoFallback.status,
      502,
      'Expected license route 502 when fallback is disabled',
    );
    assert.equal(
      licenseNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected license strangler proxy error code',
    );

    const botsNoFallback = await requestJson(baseUrl, '/api/v1/bots');
    assert.equal(botsNoFallback.status, 502, 'Expected bots route 502 when fallback is disabled');
    assert.equal(
      botsNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected bots strangler proxy error code',
    );

    const themeAssetsNoFallback = await requestJson(baseUrl, '/api/v1/theme-assets');
    assert.equal(
      themeAssetsNoFallback.status,
      502,
      'Expected theme-assets route 502 when fallback is disabled',
    );
    assert.equal(
      themeAssetsNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected theme-assets strangler proxy error code',
    );

    const ipqsNoFallback = await requestJson(baseUrl, '/api/v1/ipqs/status');
    assert.equal(ipqsNoFallback.status, 502, 'Expected ipqs route 502 when fallback is disabled');
    assert.equal(
      ipqsNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected ipqs strangler proxy error code',
    );

    const workspaceNoFallback = await requestJson(baseUrl, '/api/v1/workspace/notes');
    assert.equal(
      workspaceNoFallback.status,
      502,
      'Expected workspace route 502 when fallback is disabled',
    );
    assert.equal(
      workspaceNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected workspace strangler proxy error code',
    );

    const authNoFallback = await requestJson(baseUrl, '/api/v1/auth/whoami');
    assert.equal(authNoFallback.status, 502, 'Expected auth route 502 when fallback is disabled');
    assert.equal(
      authNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected auth strangler proxy error code',
    );

    const agentsNoFallback = await requestJson(baseUrl, '/api/v1/agents');
    assert.equal(
      agentsNoFallback.status,
      502,
      'Expected agents route 502 when fallback is disabled',
    );
    assert.equal(
      agentsNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected agents strangler proxy error code',
    );

    const resourcesNoFallback = await requestJson(baseUrl, '/api/v1/resources/licenses');
    assert.equal(
      resourcesNoFallback.status,
      502,
      'Expected resources route 502 when fallback is disabled',
    );
    assert.equal(
      resourcesNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected resources strangler proxy error code',
    );

    const financeNoFallback = await requestJson(baseUrl, '/api/v1/finance/operations');
    assert.equal(
      financeNoFallback.status,
      502,
      'Expected finance route 502 when fallback is disabled',
    );
    assert.equal(
      financeNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected finance strangler proxy error code',
    );

    const playbooksNoFallback = await requestJson(baseUrl, '/api/v1/playbooks');
    assert.equal(
      playbooksNoFallback.status,
      502,
      'Expected playbooks route 502 when fallback is disabled',
    );
    assert.equal(
      playbooksNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected playbooks strangler proxy error code',
    );

    const vmOpsNoFallback = await requestJson(baseUrl, '/api/v1/vm-ops/commands');
    assert.equal(
      vmOpsNoFallback.status,
      502,
      'Expected vm-ops route 502 when fallback is disabled',
    );
    assert.equal(
      vmOpsNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected vm-ops strangler proxy error code',
    );

    const wowNamesNoFallback = await requestJson(baseUrl, '/api/v1/wow-names');
    assert.equal(
      wowNamesNoFallback.status,
      502,
      'Expected wow-names route 502 when fallback is disabled',
    );
    assert.equal(
      wowNamesNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected wow-names strangler proxy error code',
    );

    const provisioningNoFallback = await requestJson(
      baseUrl,
      '/api/v1/provisioning/validate-token',
      {
        method: 'POST',
        body: { token: 'token-ok', vm_uuid: 'vm-1' },
      },
    );
    assert.equal(
      provisioningNoFallback.status,
      502,
      'Expected provisioning route 502 when fallback is disabled',
    );
    assert.equal(
      provisioningNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected provisioning strangler proxy error code',
    );

    const unattendProfilesNoFallback = await requestJson(baseUrl, '/api/v1/unattend-profiles');
    assert.equal(
      unattendProfilesNoFallback.status,
      502,
      'Expected unattend-profiles route 502 when fallback is disabled',
    );
    assert.equal(
      unattendProfilesNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected unattend-profiles strangler proxy error code',
    );

    const generateIsoPayloadNoFallback = await requestJson(
      baseUrl,
      '/api/v1/provisioning/generate-iso-payload',
      {
        method: 'POST',
        body: { vm_uuid: 'vm-1' },
      },
    );
    assert.equal(
      generateIsoPayloadNoFallback.status,
      502,
      'Expected generate-iso-payload route 502 when fallback is disabled',
    );
    assert.equal(
      generateIsoPayloadNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected generate-iso-payload strangler proxy error code',
    );

    const provisioningReportNoFallback = await requestJson(
      baseUrl,
      '/api/v1/provisioning/report-progress',
      {
        method: 'POST',
        body: { token: 'token-ok', vm_uuid: 'vm-1', step: 'bootstrap', status: 'running' },
      },
    );
    assert.equal(
      provisioningReportNoFallback.status,
      502,
      'Expected provisioning report-progress route 502 when fallback is disabled',
    );
    assert.equal(
      provisioningReportNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected provisioning report-progress strangler proxy error code',
    );

    const provisioningProgressNoFallback = await requestJson(
      baseUrl,
      '/api/v1/provisioning/progress/vm-1',
    );
    assert.equal(
      provisioningProgressNoFallback.status,
      502,
      'Expected provisioning progress route 502 when fallback is disabled',
    );
    assert.equal(
      provisioningProgressNoFallback.payload?.error?.code,
      'NEST_STRANGLER_PROXY_FAILED',
      'Expected provisioning progress strangler proxy error code',
    );
  });
}

async function main() {
  await checkProxyAndFallback();
  process.stdout.write('Nest strangler routing check passed.\n');
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});

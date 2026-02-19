#!/usr/bin/env node
'use strict';

const express = require('express');
const assert = require('node:assert');
const { failure } = require('../proxy-server/src/contracts/envelope');
const { createAuthRoutes } = require('../proxy-server/src/modules/v1/auth.routes');
const { createBotsRoutes } = require('../proxy-server/src/modules/v1/bots.routes');
const { createFinanceRoutes } = require('../proxy-server/src/modules/v1/finance.routes');
const { createIpqsRoutes } = require('../proxy-server/src/modules/v1/ipqs.routes');
const { createLicenseRoutes } = require('../proxy-server/src/modules/v1/license.routes');
const { createPlaybookRoutes } = require('../proxy-server/src/modules/v1/playbooks.routes');
const { createProvisioningRoutes } = require('../proxy-server/src/modules/v1/provisioning.routes');
const { createSettingsRoutes } = require('../proxy-server/src/modules/v1/settings.routes');
const { createThemeAssetsRoutes } = require('../proxy-server/src/modules/v1/theme-assets.routes');
const { createWowNamesRoutes } = require('../proxy-server/src/modules/v1/wow-names.routes');
const { LicenseServiceError } = require('../proxy-server/src/modules/license/service');
const { PlaybookServiceError } = require('../proxy-server/src/modules/playbooks/service');
const { ProvisioningServiceError } = require('../proxy-server/src/modules/provisioning/service');
const { ThemeAssetsServiceError } = require('../proxy-server/src/modules/theme-assets/service');
const { createResourcesRoutes } = require('../proxy-server/src/modules/v1/resources.routes');
const { createWorkspaceRoutes } = require('../proxy-server/src/modules/v1/workspace.routes');
const { createAgentsRoutes } = require('../proxy-server/src/modules/v1/agents.routes');
const { createVmOpsRoutes } = require('../proxy-server/src/modules/v1/vm-ops.routes');
const { VmOpsServiceError } = require('../proxy-server/src/modules/vm-ops/service');

function createDefaultAuth() {
  return {
    tenant_id: 'default',
    uid: 'user-1',
    email: 'user-1@example.com',
    source: 'supabase',
    roles: ['api', 'admin', 'infra'],
  };
}

function createAuthMiddlewareStub() {
  return {
    authenticate(req, res, next) {
      const authorization = String(req?.headers?.authorization || '').trim();
      if (!authorization.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json(failure('UNAUTHORIZED', 'Bearer token is required'));
      }
      req.auth = createDefaultAuth();
      return next();
    },
    hasRole(auth, role) {
      const roles = Array.isArray(auth?.roles) ? auth.roles : [];
      return roles.includes(role);
    },
    requireAnyRole(roles) {
      const roleSet = Array.isArray(roles) ? roles.filter(Boolean) : [];
      return (req, res, next) => {
        const current = Array.isArray(req?.auth?.roles) ? req.auth.roles : [];
        const ok = roleSet.some((role) => current.includes(role));
        if (!ok) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `One of roles is required: ${roleSet.join(', ')}`,
            },
          });
        }
        return next();
      };
    },
  };
}

function createResourcesRepoStub() {
  const store = new Map();
  return {
    async create(payload, explicitId) {
      const id = String(explicitId || payload?.id || `res-${store.size + 1}`);
      const next = { ...payload, id };
      store.set(id, next);
      return next;
    },
    async getById(id) {
      return store.get(String(id)) ?? null;
    },
    async list() {
      return [...store.values()];
    },
    async patch(id, payload) {
      const current = store.get(String(id));
      if (!current) return null;
      const next = { ...current, ...payload };
      store.set(String(id), next);
      return next;
    },
    async remove(id) {
      return store.delete(String(id));
    },
  };
}

function createWorkspaceRepoStub() {
  return createResourcesRepoStub();
}

function createSettingsRepoStub() {
  const store = new Map([['settings', {}]]);

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  return {
    async read(path) {
      return clone(store.get(String(path))) ?? null;
    },
    async write(path, payload, options = {}) {
      const key = String(path);
      const current = store.get(key);
      const shouldMerge = Boolean(options?.merge);

      let next = payload;
      if (
        shouldMerge &&
        current &&
        typeof current === 'object' &&
        !Array.isArray(current) &&
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload)
      ) {
        next = {
          ...current,
          ...payload,
        };
      }

      store.set(key, clone(next));
      return clone(next);
    },
  };
}

function createFinanceRepoStub() {
  const store = new Map();
  return {
    async list() {
      return [...store.values()];
    },
    async getById(id) {
      return store.get(String(id)) ?? null;
    },
    async create(payload, explicitId) {
      const id = String(explicitId || payload?.id || `fin-${store.size + 1}`);
      const next = {
        ...payload,
        id,
      };
      store.set(id, next);
      return next;
    },
    async patch(id, payload) {
      const current = store.get(String(id));
      if (!current) return null;
      const next = { ...current, ...payload, id: String(id) };
      store.set(String(id), next);
      return next;
    },
    async remove(id) {
      return store.delete(String(id));
    },
    async getDailyStats() {
      return {
        '2026-02-18': {
          date: '2026-02-18',
          total_expenses: 10,
          total_revenue: 25,
          net_profit: 15,
          active_bots: 1,
          total_farmed: {},
        },
      };
    },
    async getGoldPriceHistory() {
      return {
        '2026-02-18': {
          price: 12.5,
        },
      };
    },
  };
}

function createBotsRepoStub() {
  const store = new Map();
  return {
    async list() {
      return [...store.values()];
    },
    async getById(id) {
      return store.get(String(id)) ?? null;
    },
    async create(payload, explicitId) {
      const id = String(explicitId || payload?.id || `bot-${store.size + 1}`);
      const next = { ...payload, id };
      store.set(id, next);
      return next;
    },
    async patch(id, payload) {
      const current = store.get(String(id));
      if (!current) return null;
      const next = { ...current, ...payload };
      store.set(String(id), next);
      return next;
    },
    async remove(id) {
      return store.delete(String(id));
    },
    async writeLifecycleLog() {
      return undefined;
    },
    async writeArchiveEntry() {
      return undefined;
    },
  };
}

function createPlaybookServiceStub() {
  const store = new Map();

  function makeId() {
    return `playbook-${store.size + 1}`;
  }

  function validatePlaybookContent(content) {
    const normalized = String(content || '').trim();
    if (!normalized) {
      return {
        valid: false,
        errors: [{ message: 'Content is required' }],
        warnings: [],
      };
    }

    const hasYamlControl = /[:\-\n]/.test(normalized);
    const hasName = /(^|\n)\s*name\s*:/i.test(normalized);
    const hasRoles = /(^|\n)\s*roles\s*:/i.test(normalized);
    const errors = [];

    if (!hasYamlControl) {
      errors.push({ message: 'Playbook content must be YAML-like' });
    }
    if (!hasName) {
      errors.push({ path: 'name', message: 'Missing "name" field' });
    }
    if (!hasRoles) {
      errors.push({ path: 'roles', message: 'Missing "roles" field' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  return {
    validatePlaybookContent,
    async listPlaybooks() {
      return [...store.values()];
    },
    async getPlaybook({ playbookId }) {
      const record = store.get(String(playbookId));
      if (!record) {
        throw new PlaybookServiceError(404, 'PLAYBOOK_NOT_FOUND', 'Playbook not found');
      }
      return record;
    },
    async createPlaybook(payload) {
      const id = makeId();
      const next = {
        id,
        tenant_id: String(payload.tenantId || 'default'),
        user_id: String(payload.userId || 'user-1'),
        name: String(payload.name || `playbook-${store.size + 1}`),
        is_default: Boolean(payload.isDefault),
        content: String(payload.content || ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.set(id, next);
      return next;
    },
    async updatePlaybook({ playbookId, updates }) {
      const current = store.get(String(playbookId));
      if (!current) {
        throw new PlaybookServiceError(404, 'PLAYBOOK_NOT_FOUND', 'Playbook not found');
      }
      const next = {
        ...current,
        ...updates,
        id: String(playbookId),
        updated_at: new Date().toISOString(),
      };
      store.set(String(playbookId), next);
      return next;
    },
    async deletePlaybook({ playbookId }) {
      const deleted = store.delete(String(playbookId));
      if (!deleted) {
        throw new PlaybookServiceError(404, 'PLAYBOOK_NOT_FOUND', 'Playbook not found');
      }
    },
  };
}

function createAgentsServiceStub() {
  const records = new Map();
  const pairing = {
    id: 'pair-1',
    tenant_id: 'default',
    name: 'pairing',
    status: 'pending',
    pairing_code: 'BMX-DEMO',
    pairing_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
  return {
    async createPairing(input) {
      return {
        ...pairing,
        ...(input?.name ? { name: input.name } : {}),
      };
    },
    async heartbeat(input) {
      const next = {
        id: String(input.agentId),
        tenant_id: String(input.tenantId || 'default'),
        name: String(input.agentId),
        status: 'active',
        last_seen_at: new Date().toISOString(),
        metadata: {},
      };
      records.set(next.id, next);
      return next;
    },
    async listAgents() {
      return [...records.values()];
    },
    async getAgent({ agentId }) {
      return records.get(String(agentId)) || null;
    },
    async revokeAgent({ agentId }) {
      const current = records.get(String(agentId));
      if (!current) {
        return { id: String(agentId), status: 'revoked' };
      }
      const next = { ...current, status: 'revoked' };
      records.set(String(agentId), next);
      return next;
    },
  };
}

function createVmOpsServiceStub() {
  const store = new Map();
  return {
    async dispatchCommand(input) {
      const id = `cmd-${store.size + 1}`;
      const next = {
        id,
        tenant_id: String(input.tenantId || 'default'),
        agent_id: String(input.agentId),
        command_type: String(input.commandType),
        status: 'queued',
        payload: input.payload || {},
        queued_at: new Date().toISOString(),
        expires_at: null,
        started_at: null,
        completed_at: null,
        created_by: input.createdBy || null,
      };
      store.set(id, next);
      return next;
    },
    async getCommandStatus({ commandId }) {
      const record = store.get(String(commandId));
      if (!record) {
        throw new VmOpsServiceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
      }
      return record;
    },
    async listAgentCommands() {
      return [...store.values()];
    },
    async waitForNextAgentCommand() {
      return null;
    },
    async updateCommandStatus({ commandId, status, result, errorMessage }) {
      const current = store.get(String(commandId));
      if (!current) {
        throw new VmOpsServiceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
      }
      const next = {
        ...current,
        status,
        result: result ?? null,
        error_message: errorMessage ?? null,
        completed_at: new Date().toISOString(),
      };
      store.set(String(commandId), next);
      return next;
    },
    async ensureAgentAccess() {
      return true;
    },
  };
}

function createLicenseServiceStub() {
  const leases = new Map();
  return {
    async issueExecutionLease(input) {
      const leaseId = `lease-${leases.size + 1}`;
      const record = {
        lease_id: leaseId,
        token: `token-${leaseId}`,
        expires_at: Date.now() + 300_000,
        tenant_id: String(input.tenantId || 'default'),
        user_id: String(input.userId || 'user-1'),
        vm_uuid: String(input.vmUuid || 'vm-1'),
        module: String(input.moduleName || 'core'),
      };
      leases.set(leaseId, {
        ...record,
        status: 'active',
      });
      return record;
    },
    async heartbeatLease(input) {
      const leaseId = String(input.leaseId || '').trim();
      const current = leases.get(leaseId);
      if (!current) {
        throw new LicenseServiceError(404, 'LEASE_NOT_FOUND', 'Execution lease not found');
      }
      return {
        lease_id: leaseId,
        status: 'active',
        expires_at: Number(current.expires_at || Date.now() + 60_000),
        last_heartbeat_at: Date.now(),
      };
    },
    async revokeLease(input) {
      const leaseId = String(input.leaseId || '').trim();
      const current = leases.get(leaseId);
      if (!current) {
        throw new LicenseServiceError(404, 'LEASE_NOT_FOUND', 'Execution lease not found');
      }
      current.status = 'revoked';
      leases.set(leaseId, current);
      return {
        lease_id: leaseId,
        status: 'revoked',
        revoked_at: Date.now(),
      };
    },
  };
}

function createWowNamesServiceStub() {
  const names = [
    'Aldor',
    'Brannor',
    'Cindral',
    'Durok',
    'Elaria',
    'Fenric',
    'Galdor',
    'Halwen',
    'Ithran',
    'Jorim',
  ];

  return {
    async getWowNames(options = {}) {
      const countParam = Number(options.count);
      const count =
        Number.isFinite(countParam) && countParam > 0 ? Math.min(Math.floor(countParam), 50) : 0;
      const batchesParam = Number(options.batches);
      const batches =
        Number.isFinite(batchesParam) && batchesParam > 0
          ? Math.min(Math.floor(batchesParam), 5)
          : 1;

      return {
        names: count > 0 ? names.slice(0, count) : names,
        count,
        batches,
        random: names[0],
        source: 'generator-click',
      };
    },
  };
}

function createIpqsServiceStub() {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  function serviceError(status, code, message) {
    const error = new Error(String(message));
    error.status = Number(status);
    error.code = String(code);
    return error;
  }

  function hashIp(ip) {
    let hash = 0;
    for (let index = 0; index < ip.length; index += 1) {
      hash = (hash * 31 + ip.charCodeAt(index)) % 10_000;
    }
    return hash;
  }

  function buildIpqsResponse(ip) {
    const hash = hashIp(ip);
    const fraudScore = hash % 100;
    return {
      success: true,
      fraud_score: fraudScore,
      country_code: 'US',
      region: 'California',
      city: 'Los Angeles',
      zip_code: String(10_000 + (hash % 89_999)),
      isp: `ISP-${(hash % 97) + 1}`,
      organization: `Org-${(hash % 53) + 1}`,
      timezone: 'America/Los_Angeles',
      latitude: (hash % 9_000) / 100,
      longitude: (hash % 18_000) / 100,
      vpn: fraudScore >= 60,
      proxy: fraudScore >= 45,
      tor: fraudScore >= 80,
      bot_status: fraudScore >= 75,
    };
  }

  return {
    async getStatus() {
      return {
        enabled: true,
        configured: true,
        supabaseSettingsConnected: true,
      };
    },
    async checkIp(ip) {
      const normalizedIp = String(ip || '').trim();
      if (!normalizedIp) {
        throw serviceError(400, 'BAD_REQUEST', 'IP address is required');
      }
      if (!ipv4Regex.test(normalizedIp)) {
        throw serviceError(400, 'BAD_REQUEST', 'Invalid IP address format');
      }
      return buildIpqsResponse(normalizedIp);
    },
    async checkIpBatch(ips) {
      if (!Array.isArray(ips) || ips.length === 0) {
        throw serviceError(400, 'BAD_REQUEST', 'Array of IP addresses is required');
      }
      if (ips.length > 10) {
        throw serviceError(400, 'BAD_REQUEST', 'Maximum 10 IPs per batch request');
      }

      return {
        results: ips.map((item) => {
          const ip = String(item || '').trim();
          if (!ipv4Regex.test(ip)) {
            return {
              ip,
              success: false,
              error: 'Invalid IP address format',
            };
          }
          return {
            ip,
            success: true,
            data: buildIpqsResponse(ip),
          };
        }),
      };
    },
  };
}

function createProvisioningServiceStub() {
  const progressStore = new Map();
  const profileStore = new Map();
  let profileSequence = 0;
  let tokenSequence = 0;

  function nowIso() {
    return new Date().toISOString();
  }

  function nextProfileId() {
    profileSequence += 1;
    return `profile-${profileSequence}`;
  }

  function nextTokenId() {
    tokenSequence += 1;
    return `token-${tokenSequence}`;
  }

  return {
    async listProfiles() {
      return [...profileStore.values()];
    },
    async createProfile({ name, isDefault, config }) {
      const id = nextProfileId();
      const record = {
        id,
        name: String(name || 'default'),
        is_default: Boolean(isDefault),
        config: config || {},
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      profileStore.set(id, record);
      return record;
    },
    async updateProfile({ profileId, updates }) {
      const id = String(profileId);
      const current = profileStore.get(id);
      if (!current) {
        throw new ProvisioningServiceError(404, 'PROFILE_NOT_FOUND', 'Unattend profile not found');
      }
      const next = {
        ...current,
        ...updates,
        id,
        updated_at: nowIso(),
      };
      profileStore.set(id, next);
      return next;
    },
    async deleteProfile({ profileId }) {
      const id = String(profileId);
      const deleted = profileStore.delete(id);
      if (!deleted) {
        throw new ProvisioningServiceError(404, 'PROFILE_NOT_FOUND', 'Unattend profile not found');
      }
      return true;
    },
    async getProfile({ profileId }) {
      const id = String(profileId);
      const profile = profileStore.get(id);
      if (!profile) {
        throw new ProvisioningServiceError(404, 'PROFILE_NOT_FOUND', 'Unattend profile not found');
      }
      return profile;
    },
    async issueToken() {
      const tokenId = nextTokenId();
      return {
        token: `token-ok-${tokenId}`,
        tokenId,
        expiresAt: nowIso(),
      };
    },
    async validateToken(token, vmUuid) {
      if (
        String(token || '')
          .trim()
          .toLowerCase()
          .startsWith('invalid')
      ) {
        return {
          valid: false,
          reason: 'Invalid token',
        };
      }
      return {
        valid: true,
        userId: 'user-1',
        tenantId: 'default',
        tokenId: `token-${String(vmUuid || 'vm').trim() || 'vm'}`,
      };
    },
    async reportProgress({ vmUuid, step, status, details }) {
      const vmKey = String(vmUuid || '').trim() || 'vm-1';
      const item = {
        vm_uuid: vmKey,
        step: String(step || '').trim(),
        status: String(status || '').trim(),
        details: details || {},
        updated_at: nowIso(),
      };
      const existing = progressStore.get(vmKey) || [];
      progressStore.set(vmKey, [...existing, item]);
      return item;
    },
    async markUsed() {
      return true;
    },
    async getProgress({ vmUuid }) {
      const vmKey = String(vmUuid || '').trim() || 'vm-1';
      const events = progressStore.get(vmKey) || [];
      return {
        vm_uuid: vmKey,
        events,
        updated_at: events[events.length - 1]?.updated_at || nowIso(),
      };
    },
  };
}

function createThemeAssetsServiceStub() {
  const store = new Map();
  const nowIso = new Date().toISOString();
  const initialId = 'theme-asset-1';

  store.set(initialId, {
    id: initialId,
    object_key: `theme-assets/default/${initialId}-background.png`,
    mime_type: 'image/png',
    size_bytes: 1024,
    width: 1920,
    height: 1080,
    status: 'ready',
    image_url: 'https://example.local/assets/theme-asset-1.png',
    image_url_expires_at_ms: Date.now() + 300_000,
    created_at: nowIso,
    updated_at: nowIso,
  });

  return {
    enabled: true,
    async listAssets() {
      return {
        generated_at_ms: Date.now(),
        items: [...store.values()],
      };
    },
    async createPresignedUpload({ filename, mimeType, sizeBytes }) {
      const assetId = `theme-asset-${store.size + 1}`;
      const objectKey = `theme-assets/default/${assetId}-${String(filename || 'background')
        .replace(/\s+/g, '-')
        .toLowerCase()}`;
      store.set(assetId, {
        id: assetId,
        object_key: objectKey,
        mime_type: String(mimeType),
        size_bytes: Number(sizeBytes),
        width: null,
        height: null,
        status: 'pending',
        image_url: null,
        image_url_expires_at_ms: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return {
        asset_id: assetId,
        object_key: objectKey,
        upload_url: `https://example.local/upload/${assetId}`,
        expires_at_ms: Date.now() + 600_000,
        expires_in_seconds: 600,
      };
    },
    async completeUpload({ assetId, width, height }) {
      const current = store.get(String(assetId));
      if (!current) {
        throw new ThemeAssetsServiceError(404, 'NOT_FOUND', 'Theme asset not found');
      }
      const next = {
        ...current,
        status: 'ready',
        width: Number.isFinite(width) ? Number(width) : (current.width ?? null),
        height: Number.isFinite(height) ? Number(height) : (current.height ?? null),
        image_url: `https://example.local/assets/${assetId}.png`,
        image_url_expires_at_ms: Date.now() + 300_000,
        updated_at: new Date().toISOString(),
      };
      store.set(String(assetId), next);
      return next;
    },
    async deleteAsset({ assetId }) {
      const current = store.get(String(assetId));
      if (!current || current.status === 'deleted') {
        throw new ThemeAssetsServiceError(404, 'NOT_FOUND', 'Theme asset not found');
      }
      store.set(String(assetId), {
        ...current,
        status: 'deleted',
        updated_at: new Date().toISOString(),
      });
      return {
        id: String(assetId),
        status: 'deleted',
      };
    },
  };
}

function createLegacyParityApp() {
  const app = express();
  const auth = createAuthMiddlewareStub();
  const resourcesRepo = createResourcesRepoStub();
  const settingsRepo = createSettingsRepoStub();
  const workspaceNotesRepo = createWorkspaceRepoStub();
  const workspaceCalendarRepo = createWorkspaceRepoStub();
  const workspaceKanbanRepo = createWorkspaceRepoStub();
  const financeRepo = createFinanceRepoStub();
  const botsRepo = createBotsRepoStub();
  const playbookService = createPlaybookServiceStub();
  const ipqsService = createIpqsServiceStub();
  const wowNamesService = createWowNamesServiceStub();
  const agentsService = createAgentsServiceStub();
  const vmOpsService = createVmOpsServiceStub();
  const licenseService = createLicenseServiceStub();
  const provisioningService = createProvisioningServiceStub();
  const themeAssetsService = createThemeAssetsServiceStub();

  app.use(express.json());
  app.use((req, _res, next) => {
    const auth = createDefaultAuth();
    const requestedSource = String(req.headers['x-test-auth-source'] || '')
      .trim()
      .toLowerCase();
    if (requestedSource === 'agent') {
      const requestedAgentId = String(req.headers['x-test-agent-id'] || '').trim() || 'agent-1';
      auth.source = 'agent';
      auth.agent_id = requestedAgentId;
      auth.uid = `agent:${requestedAgentId}`;
      auth.roles = ['api'];
    }

    req.auth = auth;
    next();
  });

  app.use(
    '/api/v1/auth',
    createAuthRoutes({
      authenticate: auth.authenticate,
    }),
  );

  app.use(
    '/api/v1/bots',
    createBotsRoutes({
      repo: botsRepo,
    }),
  );
  app.use(
    '/api/v1/playbooks',
    createPlaybookRoutes({
      playbookService,
    }),
  );
  app.use(
    '/api/v1/ipqs',
    createIpqsRoutes({
      ipqsService,
    }),
  );
  app.use(
    '/api/v1/wow-names',
    createWowNamesRoutes({
      wowNamesService,
    }),
  );

  app.use(
    '/api/v1/settings',
    createSettingsRoutes({
      repo: settingsRepo,
    }),
  );

  app.use(
    '/api/v1/resources',
    createResourcesRoutes({
      repositories: {
        licenses: resourcesRepo,
        proxies: resourcesRepo,
        subscriptions: resourcesRepo,
      },
    }),
  );
  app.use(
    '/api/v1/workspace',
    createWorkspaceRoutes({
      repositories: {
        notes: workspaceNotesRepo,
        calendar: workspaceCalendarRepo,
        kanban: workspaceKanbanRepo,
      },
    }),
  );
  app.use(
    '/api/v1/finance',
    createFinanceRoutes({
      repo: financeRepo,
    }),
  );
  app.use(
    '/api/v1/license',
    createLicenseRoutes({
      licenseService,
      authMiddleware: auth,
    }),
  );
  app.use(
    '/api/v1/theme-assets',
    createThemeAssetsRoutes({
      themeAssetsService,
    }),
  );
  app.use(
    '/api/v1',
    createProvisioningRoutes({
      provisioningService,
      playbookService,
      s3Service: null,
      env: {
        agentPairingPublicUrl: 'http://127.0.0.1:3001',
        port: 3001,
        s3Endpoint: 'http://127.0.0.1:9000',
      },
    }),
  );
  app.use(
    '/api/v1/agents',
    createAgentsRoutes({
      agentService: agentsService,
      authMiddleware: auth,
      env: {},
    }),
  );
  app.use(
    '/api/v1/vm-ops',
    createVmOpsRoutes({
      vmOpsService,
      authMiddleware: auth,
    }),
  );

  return app;
}

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const address = server.address();
    assert(address && typeof address === 'object' && 'port' in address);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    return await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function apiRequest(baseUrl, method, path, body, extraHeaders) {
  const headers = { ...(extraHeaders || {}) };
  if (
    body !== undefined &&
    !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
  ) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const rawBody = await response.text();
  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    throw new Error(
      `Expected JSON response for ${method} ${path}, got status ${response.status}: ${rawBody.slice(0, 200)}`,
    );
  }

  return {
    payload,
    status: response.status,
  };
}

function assertSchema(name, schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`${name} schema validation failed: ${JSON.stringify(parsed.error.flatten())}`);
  }
}

async function run() {
  const { apiContract } = await import('../packages/api-contract/dist/contract.js');
  const baseUnattendProfileConfig = {
    user: {
      nameMode: 'random',
    },
    computerName: {
      mode: 'random',
    },
    locale: {},
    softwareRemoval: {
      mode: 'fixed',
    },
    capabilityRemoval: {
      mode: 'fixed',
    },
    windowsSettings: {},
    visualEffects: {},
    desktopIcons: {},
  };

  const app = createLegacyParityApp();
  await withServer(app, async (baseUrl) => {
    const authVerify = await apiRequest(baseUrl, 'GET', '/api/v1/auth/verify', undefined, {
      authorization: 'Bearer test-token',
    });
    if (authVerify.status !== 200) throw new Error(`authVerify status ${authVerify.status}`);
    assertSchema('authVerify', apiContract.authVerify.responses[200], authVerify.payload);

    const authWhoAmI = await apiRequest(baseUrl, 'GET', '/api/v1/auth/whoami', undefined, {
      authorization: 'Bearer test-token',
    });
    if (authWhoAmI.status !== 200) throw new Error(`authWhoAmI status ${authWhoAmI.status}`);
    assertSchema('authWhoAmI', apiContract.authWhoAmI.responses[200], authWhoAmI.payload);

    const authVerifyMissingToken = await apiRequest(baseUrl, 'GET', '/api/v1/auth/verify');
    if (authVerifyMissingToken.status !== 401)
      throw new Error(`authVerifyMissingToken status ${authVerifyMissingToken.status}`);
    assertSchema(
      'authVerifyMissingToken',
      apiContract.authVerify.responses[401],
      authVerifyMissingToken.payload,
    );

    const provisioningValidateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/validate-token',
      {},
    );
    if (provisioningValidateInvalid.status !== 400) {
      throw new Error(`provisioningValidateInvalid status ${provisioningValidateInvalid.status}`);
    }
    assertSchema(
      'provisioningValidateInvalid',
      apiContract.provisioningValidateToken.responses[400],
      provisioningValidateInvalid.payload,
    );

    const provisioningValidate = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/validate-token',
      {
        token: 'token-ok',
        vm_uuid: 'vm-1',
      },
    );
    if (provisioningValidate.status !== 200) {
      throw new Error(`provisioningValidate status ${provisioningValidate.status}`);
    }
    assertSchema(
      'provisioningValidate',
      apiContract.provisioningValidateToken.responses[200],
      provisioningValidate.payload,
    );

    const provisioningValidateInvalidToken = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/validate-token',
      {
        token: 'invalid-token',
        vm_uuid: 'vm-1',
      },
    );
    if (provisioningValidateInvalidToken.status !== 401) {
      throw new Error(
        `provisioningValidateInvalidToken status ${provisioningValidateInvalidToken.status}`,
      );
    }
    assertSchema(
      'provisioningValidateInvalidToken',
      apiContract.provisioningValidateToken.responses[401],
      provisioningValidateInvalidToken.payload,
    );

    const provisioningReportInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/report-progress',
      {},
    );
    if (provisioningReportInvalid.status !== 400) {
      throw new Error(`provisioningReportInvalid status ${provisioningReportInvalid.status}`);
    }
    assertSchema(
      'provisioningReportInvalid',
      apiContract.provisioningReportProgress.responses[400],
      provisioningReportInvalid.payload,
    );

    const provisioningReport = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/report-progress',
      {
        token: 'token-ok',
        vm_uuid: 'vm-1',
        step: 'bootstrap',
        status: 'running',
        details: {
          source: 'contract-parity',
        },
      },
    );
    if (provisioningReport.status !== 200) {
      throw new Error(`provisioningReport status ${provisioningReport.status}`);
    }
    assertSchema(
      'provisioningReport',
      apiContract.provisioningReportProgress.responses[200],
      provisioningReport.payload,
    );

    const provisioningReportInvalidToken = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/report-progress',
      {
        token: 'invalid-token',
        vm_uuid: 'vm-1',
        step: 'bootstrap',
        status: 'running',
      },
    );
    if (provisioningReportInvalidToken.status !== 401) {
      throw new Error(
        `provisioningReportInvalidToken status ${provisioningReportInvalidToken.status}`,
      );
    }
    assertSchema(
      'provisioningReportInvalidToken',
      apiContract.provisioningReportProgress.responses[401],
      provisioningReportInvalidToken.payload,
    );

    const provisioningProgress = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/provisioning/progress/vm-1',
      undefined,
      {
        authorization: 'Bearer test-token',
      },
    );
    if (provisioningProgress.status !== 200) {
      throw new Error(`provisioningProgress status ${provisioningProgress.status}`);
    }
    assertSchema(
      'provisioningProgress',
      apiContract.provisioningGetProgress.responses[200],
      provisioningProgress.payload,
    );

    const unattendProfilesCreateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/unattend-profiles',
      {},
    );
    if (unattendProfilesCreateInvalid.status !== 400) {
      throw new Error(
        `unattendProfilesCreateInvalid status ${unattendProfilesCreateInvalid.status}`,
      );
    }
    assertSchema(
      'unattendProfilesCreateInvalid',
      apiContract.unattendProfilesCreate.responses[400],
      unattendProfilesCreateInvalid.payload,
    );

    const unattendProfilesCreate = await apiRequest(baseUrl, 'POST', '/api/v1/unattend-profiles', {
      name: 'default-profile',
      is_default: true,
      config: baseUnattendProfileConfig,
    });
    if (unattendProfilesCreate.status !== 201) {
      throw new Error(`unattendProfilesCreate status ${unattendProfilesCreate.status}`);
    }
    assertSchema(
      'unattendProfilesCreate',
      apiContract.unattendProfilesCreate.responses[201],
      unattendProfilesCreate.payload,
    );
    const createdUnattendProfileId = String(unattendProfilesCreate.payload?.data?.id || '');
    if (!createdUnattendProfileId) {
      throw new Error('unattendProfilesCreate missing id');
    }

    const unattendProfilesList = await apiRequest(baseUrl, 'GET', '/api/v1/unattend-profiles');
    if (unattendProfilesList.status !== 200) {
      throw new Error(`unattendProfilesList status ${unattendProfilesList.status}`);
    }
    assertSchema(
      'unattendProfilesList',
      apiContract.unattendProfilesList.responses[200],
      unattendProfilesList.payload,
    );

    const unattendProfilesUpdate = await apiRequest(
      baseUrl,
      'PUT',
      `/api/v1/unattend-profiles/${encodeURIComponent(createdUnattendProfileId)}`,
      {
        name: 'default-profile-updated',
      },
    );
    if (unattendProfilesUpdate.status !== 200) {
      throw new Error(`unattendProfilesUpdate status ${unattendProfilesUpdate.status}`);
    }
    assertSchema(
      'unattendProfilesUpdate',
      apiContract.unattendProfilesUpdate.responses[200],
      unattendProfilesUpdate.payload,
    );

    const unattendProfilesUpdateMissing = await apiRequest(
      baseUrl,
      'PUT',
      '/api/v1/unattend-profiles/missing-profile',
      {
        name: 'missing-profile-updated',
      },
    );
    if (unattendProfilesUpdateMissing.status !== 404) {
      throw new Error(
        `unattendProfilesUpdateMissing status ${unattendProfilesUpdateMissing.status}`,
      );
    }
    assertSchema(
      'unattendProfilesUpdateMissing',
      apiContract.unattendProfilesUpdate.responses[404],
      unattendProfilesUpdateMissing.payload,
    );

    const provisioningGenerateIsoPayloadInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/generate-iso-payload',
      {},
    );
    if (provisioningGenerateIsoPayloadInvalid.status !== 400) {
      throw new Error(
        `provisioningGenerateIsoPayloadInvalid status ${provisioningGenerateIsoPayloadInvalid.status}`,
      );
    }
    assertSchema(
      'provisioningGenerateIsoPayloadInvalid',
      apiContract.provisioningGenerateIsoPayload.responses[400],
      provisioningGenerateIsoPayloadInvalid.payload,
    );

    const provisioningGenerateIsoPayload = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/generate-iso-payload',
      {
        profile_config: baseUnattendProfileConfig,
        vm_uuid: 'vm-iso-1',
        ip: {
          address: '192.168.1.15',
          gateway: '192.168.1.1',
        },
      },
    );
    if (provisioningGenerateIsoPayload.status !== 200) {
      throw new Error(
        `provisioningGenerateIsoPayload status ${provisioningGenerateIsoPayload.status}`,
      );
    }
    assertSchema(
      'provisioningGenerateIsoPayload',
      apiContract.provisioningGenerateIsoPayload.responses[200],
      provisioningGenerateIsoPayload.payload,
    );

    const provisioningGenerateIsoPayloadMissingProfile = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/provisioning/generate-iso-payload',
      {
        profile_id: 'missing-profile',
        vm_uuid: 'vm-iso-2',
        ip: {
          address: '192.168.1.16',
          gateway: '192.168.1.1',
        },
      },
    );
    if (provisioningGenerateIsoPayloadMissingProfile.status !== 404) {
      throw new Error(
        'provisioningGenerateIsoPayloadMissingProfile status ' +
          provisioningGenerateIsoPayloadMissingProfile.status,
      );
    }
    assertSchema(
      'provisioningGenerateIsoPayloadMissingProfile',
      apiContract.provisioningGenerateIsoPayload.responses[404],
      provisioningGenerateIsoPayloadMissingProfile.payload,
    );

    const unattendProfilesDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/unattend-profiles/${encodeURIComponent(createdUnattendProfileId)}`,
    );
    if (unattendProfilesDelete.status !== 200) {
      throw new Error(`unattendProfilesDelete status ${unattendProfilesDelete.status}`);
    }
    assertSchema(
      'unattendProfilesDelete',
      apiContract.unattendProfilesDelete.responses[200],
      unattendProfilesDelete.payload,
    );

    const unattendProfilesDeleteMissing = await apiRequest(
      baseUrl,
      'DELETE',
      '/api/v1/unattend-profiles/missing-profile',
    );
    if (unattendProfilesDeleteMissing.status !== 404) {
      throw new Error(
        `unattendProfilesDeleteMissing status ${unattendProfilesDeleteMissing.status}`,
      );
    }
    assertSchema(
      'unattendProfilesDeleteMissing',
      apiContract.unattendProfilesDelete.responses[404],
      unattendProfilesDeleteMissing.payload,
    );

    const botsCreateInvalid = await apiRequest(baseUrl, 'POST', '/api/v1/bots', {});
    if (botsCreateInvalid.status !== 400) {
      throw new Error(`botsCreateInvalid status ${botsCreateInvalid.status}`);
    }
    assertSchema(
      'botsCreateInvalid',
      apiContract.botsCreate.responses[400],
      botsCreateInvalid.payload,
    );

    const botsCreate = await apiRequest(baseUrl, 'POST', '/api/v1/bots', {
      name: 'bot-1',
      status: 'offline',
    });
    if (botsCreate.status !== 201) throw new Error(`botsCreate status ${botsCreate.status}`);
    assertSchema('botsCreate', apiContract.botsCreate.responses[201], botsCreate.payload);
    const createdBotId = String(botsCreate.payload?.data?.id || '');
    if (!createdBotId) throw new Error('botsCreate missing id');

    const botsList = await apiRequest(baseUrl, 'GET', '/api/v1/bots?page=1&limit=10');
    if (botsList.status !== 200) throw new Error(`botsList status ${botsList.status}`);
    assertSchema('botsList', apiContract.botsList.responses[200], botsList.payload);

    const botsGet = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}`,
    );
    if (botsGet.status !== 200) throw new Error(`botsGet status ${botsGet.status}`);
    assertSchema('botsGet', apiContract.botsGet.responses[200], botsGet.payload);

    const botsPatch = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}`,
      {
        status: 'prepare',
      },
    );
    if (botsPatch.status !== 200) throw new Error(`botsPatch status ${botsPatch.status}`);
    assertSchema('botsPatch', apiContract.botsPatch.responses[200], botsPatch.payload);

    const botLifecycle = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle`,
    );
    if (botLifecycle.status !== 200) throw new Error(`botLifecycle status ${botLifecycle.status}`);
    assertSchema('botLifecycle', apiContract.botsLifecycleGet.responses[200], botLifecycle.payload);

    const botLifecycleTransitions = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/transitions`,
    );
    if (botLifecycleTransitions.status !== 200) {
      throw new Error(`botLifecycleTransitions status ${botLifecycleTransitions.status}`);
    }
    assertSchema(
      'botLifecycleTransitions',
      apiContract.botsLifecycleTransitions.responses[200],
      botLifecycleTransitions.payload,
    );

    const botLifecycleIsBannedBefore = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/is-banned`,
    );
    if (botLifecycleIsBannedBefore.status !== 200) {
      throw new Error(`botLifecycleIsBannedBefore status ${botLifecycleIsBannedBefore.status}`);
    }
    assertSchema(
      'botLifecycleIsBannedBefore',
      apiContract.botsLifecycleIsBanned.responses[200],
      botLifecycleIsBannedBefore.payload,
    );

    const botLifecycleTransitionInvalid = await apiRequest(
      baseUrl,
      'POST',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/transition`,
      {},
    );
    if (botLifecycleTransitionInvalid.status !== 400) {
      throw new Error(
        `botLifecycleTransitionInvalid status ${botLifecycleTransitionInvalid.status}`,
      );
    }
    assertSchema(
      'botLifecycleTransitionInvalid',
      apiContract.botsLifecycleTransition.responses[400],
      botLifecycleTransitionInvalid.payload,
    );

    const botLifecycleTransitionToBanned = await apiRequest(
      baseUrl,
      'POST',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/transition`,
      { status: 'banned' },
    );
    if (botLifecycleTransitionToBanned.status !== 400) {
      throw new Error(
        `botLifecycleTransitionToBanned status ${botLifecycleTransitionToBanned.status}`,
      );
    }
    assertSchema(
      'botLifecycleTransitionToBanned',
      apiContract.botsLifecycleTransition.responses[400],
      botLifecycleTransitionToBanned.payload,
    );

    const botLifecycleTransition = await apiRequest(
      baseUrl,
      'POST',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/transition`,
      { status: 'leveling' },
    );
    if (botLifecycleTransition.status !== 200) {
      throw new Error(`botLifecycleTransition status ${botLifecycleTransition.status}`);
    }
    assertSchema(
      'botLifecycleTransition',
      apiContract.botsLifecycleTransition.responses[200],
      botLifecycleTransition.payload,
    );

    const botLifecycleBanInvalid = await apiRequest(
      baseUrl,
      'POST',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/ban`,
      {},
    );
    if (botLifecycleBanInvalid.status !== 400) {
      throw new Error(`botLifecycleBanInvalid status ${botLifecycleBanInvalid.status}`);
    }
    assertSchema(
      'botLifecycleBanInvalid',
      apiContract.botsLifecycleBan.responses[400],
      botLifecycleBanInvalid.payload,
    );

    const botLifecycleBan = await apiRequest(
      baseUrl,
      'POST',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/ban`,
      {
        ban_date: '18.02.2026',
        ban_reason: 'Parity test',
        ban_mechanism: 'other',
      },
    );
    if (botLifecycleBan.status !== 200) {
      throw new Error(`botLifecycleBan status ${botLifecycleBan.status}`);
    }
    assertSchema(
      'botLifecycleBan',
      apiContract.botsLifecycleBan.responses[200],
      botLifecycleBan.payload,
    );

    const botLifecycleIsBannedAfterBan = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/is-banned`,
    );
    if (botLifecycleIsBannedAfterBan.status !== 200) {
      throw new Error(`botLifecycleIsBannedAfterBan status ${botLifecycleIsBannedAfterBan.status}`);
    }
    assertSchema(
      'botLifecycleIsBannedAfterBan',
      apiContract.botsLifecycleIsBanned.responses[200],
      botLifecycleIsBannedAfterBan.payload,
    );

    const botLifecycleUnban = await apiRequest(
      baseUrl,
      'POST',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}/lifecycle/unban`,
      {},
    );
    if (botLifecycleUnban.status !== 200) {
      throw new Error(`botLifecycleUnban status ${botLifecycleUnban.status}`);
    }
    assertSchema(
      'botLifecycleUnban',
      apiContract.botsLifecycleUnban.responses[200],
      botLifecycleUnban.payload,
    );

    const botsMissing = await apiRequest(baseUrl, 'GET', '/api/v1/bots/missing-bot');
    if (botsMissing.status !== 404) throw new Error(`botsMissing status ${botsMissing.status}`);
    assertSchema('botsMissing', apiContract.botsGet.responses[404], botsMissing.payload);

    const botsDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/bots/${encodeURIComponent(createdBotId)}`,
    );
    if (botsDelete.status !== 200) throw new Error(`botsDelete status ${botsDelete.status}`);
    assertSchema('botsDelete', apiContract.botsDelete.responses[200], botsDelete.payload);

    const workspaceNotesCreateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/workspace/notes',
      {},
    );
    if (workspaceNotesCreateInvalid.status !== 400) {
      throw new Error(`workspaceNotesCreateInvalid status ${workspaceNotesCreateInvalid.status}`);
    }
    assertSchema(
      'workspaceNotesCreateInvalid',
      apiContract.workspaceNotesCreate.responses[400],
      workspaceNotesCreateInvalid.payload,
    );

    const workspaceNotesCreate = await apiRequest(baseUrl, 'POST', '/api/v1/workspace/notes', {
      title: 'Ops runbook',
      content: 'Draft checklist',
    });
    if (workspaceNotesCreate.status !== 201) {
      throw new Error(`workspaceNotesCreate status ${workspaceNotesCreate.status}`);
    }
    assertSchema(
      'workspaceNotesCreate',
      apiContract.workspaceNotesCreate.responses[201],
      workspaceNotesCreate.payload,
    );
    const createdNoteId = String(workspaceNotesCreate.payload?.data?.id || '');
    if (!createdNoteId) throw new Error('workspaceNotesCreate missing id');

    const workspaceNotesList = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/workspace/notes?page=1&limit=10',
    );
    if (workspaceNotesList.status !== 200) {
      throw new Error(`workspaceNotesList status ${workspaceNotesList.status}`);
    }
    assertSchema(
      'workspaceNotesList',
      apiContract.workspaceNotesList.responses[200],
      workspaceNotesList.payload,
    );

    const workspaceNotesGet = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/workspace/notes/${encodeURIComponent(createdNoteId)}`,
    );
    if (workspaceNotesGet.status !== 200) {
      throw new Error(`workspaceNotesGet status ${workspaceNotesGet.status}`);
    }
    assertSchema(
      'workspaceNotesGet',
      apiContract.workspaceNotesGet.responses[200],
      workspaceNotesGet.payload,
    );

    const workspaceNotesPatch = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/workspace/notes/${encodeURIComponent(createdNoteId)}`,
      { title: 'Ops runbook updated' },
    );
    if (workspaceNotesPatch.status !== 200) {
      throw new Error(`workspaceNotesPatch status ${workspaceNotesPatch.status}`);
    }
    assertSchema(
      'workspaceNotesPatch',
      apiContract.workspaceNotesPatch.responses[200],
      workspaceNotesPatch.payload,
    );

    const workspaceNotesMissing = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/workspace/notes/missing-note',
    );
    if (workspaceNotesMissing.status !== 404) {
      throw new Error(`workspaceNotesMissing status ${workspaceNotesMissing.status}`);
    }
    assertSchema(
      'workspaceNotesMissing',
      apiContract.workspaceNotesGet.responses[404],
      workspaceNotesMissing.payload,
    );

    const workspaceNotesDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/workspace/notes/${encodeURIComponent(createdNoteId)}`,
    );
    if (workspaceNotesDelete.status !== 200) {
      throw new Error(`workspaceNotesDelete status ${workspaceNotesDelete.status}`);
    }
    assertSchema(
      'workspaceNotesDelete',
      apiContract.workspaceNotesDelete.responses[200],
      workspaceNotesDelete.payload,
    );

    const workspaceCalendarCreateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/workspace/calendar',
      {},
    );
    if (workspaceCalendarCreateInvalid.status !== 400) {
      throw new Error(
        `workspaceCalendarCreateInvalid status ${workspaceCalendarCreateInvalid.status}`,
      );
    }
    assertSchema(
      'workspaceCalendarCreateInvalid',
      apiContract.workspaceCalendarCreate.responses[400],
      workspaceCalendarCreateInvalid.payload,
    );

    const workspaceCalendarCreate = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/workspace/calendar',
      {
        title: 'Deployment window',
        date: '2026-02-18',
      },
    );
    if (workspaceCalendarCreate.status !== 201) {
      throw new Error(`workspaceCalendarCreate status ${workspaceCalendarCreate.status}`);
    }
    assertSchema(
      'workspaceCalendarCreate',
      apiContract.workspaceCalendarCreate.responses[201],
      workspaceCalendarCreate.payload,
    );
    const createdCalendarId = String(workspaceCalendarCreate.payload?.data?.id || '');
    if (!createdCalendarId) throw new Error('workspaceCalendarCreate missing id');

    const workspaceCalendarList = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/workspace/calendar?page=1&limit=10',
    );
    if (workspaceCalendarList.status !== 200) {
      throw new Error(`workspaceCalendarList status ${workspaceCalendarList.status}`);
    }
    assertSchema(
      'workspaceCalendarList',
      apiContract.workspaceCalendarList.responses[200],
      workspaceCalendarList.payload,
    );

    const workspaceCalendarGet = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/workspace/calendar/${encodeURIComponent(createdCalendarId)}`,
    );
    if (workspaceCalendarGet.status !== 200) {
      throw new Error(`workspaceCalendarGet status ${workspaceCalendarGet.status}`);
    }
    assertSchema(
      'workspaceCalendarGet',
      apiContract.workspaceCalendarGet.responses[200],
      workspaceCalendarGet.payload,
    );

    const workspaceCalendarPatch = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/workspace/calendar/${encodeURIComponent(createdCalendarId)}`,
      { description: 'Updated description' },
    );
    if (workspaceCalendarPatch.status !== 200) {
      throw new Error(`workspaceCalendarPatch status ${workspaceCalendarPatch.status}`);
    }
    assertSchema(
      'workspaceCalendarPatch',
      apiContract.workspaceCalendarPatch.responses[200],
      workspaceCalendarPatch.payload,
    );

    const workspaceCalendarMissing = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/workspace/calendar/missing-calendar',
    );
    if (workspaceCalendarMissing.status !== 404) {
      throw new Error(`workspaceCalendarMissing status ${workspaceCalendarMissing.status}`);
    }
    assertSchema(
      'workspaceCalendarMissing',
      apiContract.workspaceCalendarGet.responses[404],
      workspaceCalendarMissing.payload,
    );

    const workspaceCalendarDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/workspace/calendar/${encodeURIComponent(createdCalendarId)}`,
    );
    if (workspaceCalendarDelete.status !== 200) {
      throw new Error(`workspaceCalendarDelete status ${workspaceCalendarDelete.status}`);
    }
    assertSchema(
      'workspaceCalendarDelete',
      apiContract.workspaceCalendarDelete.responses[200],
      workspaceCalendarDelete.payload,
    );

    const workspaceKanbanCreateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/workspace/kanban',
      {},
    );
    if (workspaceKanbanCreateInvalid.status !== 400) {
      throw new Error(`workspaceKanbanCreateInvalid status ${workspaceKanbanCreateInvalid.status}`);
    }
    assertSchema(
      'workspaceKanbanCreateInvalid',
      apiContract.workspaceKanbanCreate.responses[400],
      workspaceKanbanCreateInvalid.payload,
    );

    const workspaceKanbanCreate = await apiRequest(baseUrl, 'POST', '/api/v1/workspace/kanban', {
      title: 'Prepare agent smoke tests',
      status: 'todo',
    });
    if (workspaceKanbanCreate.status !== 201) {
      throw new Error(`workspaceKanbanCreate status ${workspaceKanbanCreate.status}`);
    }
    assertSchema(
      'workspaceKanbanCreate',
      apiContract.workspaceKanbanCreate.responses[201],
      workspaceKanbanCreate.payload,
    );
    const createdKanbanId = String(workspaceKanbanCreate.payload?.data?.id || '');
    if (!createdKanbanId) throw new Error('workspaceKanbanCreate missing id');

    const workspaceKanbanList = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/workspace/kanban?page=1&limit=10',
    );
    if (workspaceKanbanList.status !== 200) {
      throw new Error(`workspaceKanbanList status ${workspaceKanbanList.status}`);
    }
    assertSchema(
      'workspaceKanbanList',
      apiContract.workspaceKanbanList.responses[200],
      workspaceKanbanList.payload,
    );

    const workspaceKanbanGet = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/workspace/kanban/${encodeURIComponent(createdKanbanId)}`,
    );
    if (workspaceKanbanGet.status !== 200) {
      throw new Error(`workspaceKanbanGet status ${workspaceKanbanGet.status}`);
    }
    assertSchema(
      'workspaceKanbanGet',
      apiContract.workspaceKanbanGet.responses[200],
      workspaceKanbanGet.payload,
    );

    const workspaceKanbanPatch = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/workspace/kanban/${encodeURIComponent(createdKanbanId)}`,
      { status: 'in_progress' },
    );
    if (workspaceKanbanPatch.status !== 200) {
      throw new Error(`workspaceKanbanPatch status ${workspaceKanbanPatch.status}`);
    }
    assertSchema(
      'workspaceKanbanPatch',
      apiContract.workspaceKanbanPatch.responses[200],
      workspaceKanbanPatch.payload,
    );

    const workspaceKanbanMissing = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/workspace/kanban/missing-kanban',
    );
    if (workspaceKanbanMissing.status !== 404) {
      throw new Error(`workspaceKanbanMissing status ${workspaceKanbanMissing.status}`);
    }
    assertSchema(
      'workspaceKanbanMissing',
      apiContract.workspaceKanbanGet.responses[404],
      workspaceKanbanMissing.payload,
    );

    const workspaceKanbanDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/workspace/kanban/${encodeURIComponent(createdKanbanId)}`,
    );
    if (workspaceKanbanDelete.status !== 200) {
      throw new Error(`workspaceKanbanDelete status ${workspaceKanbanDelete.status}`);
    }
    assertSchema(
      'workspaceKanbanDelete',
      apiContract.workspaceKanbanDelete.responses[200],
      workspaceKanbanDelete.payload,
    );

    const resourcesCreateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/resources/licenses',
      {},
    );
    if (resourcesCreateInvalid.status !== 400) {
      throw new Error(`resourcesCreateInvalid status ${resourcesCreateInvalid.status}`);
    }
    assertSchema(
      'resourcesCreateInvalid',
      apiContract.resourcesCreate.responses[400],
      resourcesCreateInvalid.payload,
    );

    const settingsApiKeysGetInitial = await apiRequest(baseUrl, 'GET', '/api/v1/settings/api_keys');
    if (settingsApiKeysGetInitial.status !== 200) {
      throw new Error(`settingsApiKeysGetInitial status ${settingsApiKeysGetInitial.status}`);
    }
    assertSchema(
      'settingsApiKeysGetInitial',
      apiContract.settingsApiKeysGet.responses[200],
      settingsApiKeysGetInitial.payload,
    );

    const settingsApiKeysPutInvalid = await apiRequest(
      baseUrl,
      'PUT',
      '/api/v1/settings/api_keys',
      {},
    );
    if (settingsApiKeysPutInvalid.status !== 400) {
      throw new Error(`settingsApiKeysPutInvalid status ${settingsApiKeysPutInvalid.status}`);
    }
    assertSchema(
      'settingsApiKeysPutInvalid',
      apiContract.settingsApiKeysPut.responses[400],
      settingsApiKeysPutInvalid.payload,
    );

    const settingsApiKeysPut = await apiRequest(baseUrl, 'PUT', '/api/v1/settings/api_keys', {
      ipqs: {
        api_key: 'demo-key',
        enabled: true,
      },
    });
    if (settingsApiKeysPut.status !== 200) {
      throw new Error(`settingsApiKeysPut status ${settingsApiKeysPut.status}`);
    }
    assertSchema(
      'settingsApiKeysPut',
      apiContract.settingsApiKeysPut.responses[200],
      settingsApiKeysPut.payload,
    );

    const settingsProxyGetInitial = await apiRequest(baseUrl, 'GET', '/api/v1/settings/proxy');
    if (settingsProxyGetInitial.status !== 200) {
      throw new Error(`settingsProxyGetInitial status ${settingsProxyGetInitial.status}`);
    }
    assertSchema(
      'settingsProxyGetInitial',
      apiContract.settingsProxyGet.responses[200],
      settingsProxyGetInitial.payload,
    );

    const settingsProxyPutInvalid = await apiRequest(baseUrl, 'PUT', '/api/v1/settings/proxy', {});
    if (settingsProxyPutInvalid.status !== 400) {
      throw new Error(`settingsProxyPutInvalid status ${settingsProxyPutInvalid.status}`);
    }
    assertSchema(
      'settingsProxyPutInvalid',
      apiContract.settingsProxyPut.responses[400],
      settingsProxyPutInvalid.payload,
    );

    const settingsProxyPut = await apiRequest(baseUrl, 'PUT', '/api/v1/settings/proxy', {
      auto_check_on_add: true,
      fraud_score_threshold: 70,
      check_interval_hours: 12,
    });
    if (settingsProxyPut.status !== 200) {
      throw new Error(`settingsProxyPut status ${settingsProxyPut.status}`);
    }
    assertSchema(
      'settingsProxyPut',
      apiContract.settingsProxyPut.responses[200],
      settingsProxyPut.payload,
    );

    const settingsEventsGetInitial = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/settings/notifications/events',
    );
    if (settingsEventsGetInitial.status !== 200) {
      throw new Error(`settingsEventsGetInitial status ${settingsEventsGetInitial.status}`);
    }
    assertSchema(
      'settingsEventsGetInitial',
      apiContract.settingsNotificationEventsGet.responses[200],
      settingsEventsGetInitial.payload,
    );

    const settingsEventsPutInvalid = await apiRequest(
      baseUrl,
      'PUT',
      '/api/v1/settings/notifications/events',
      {},
    );
    if (settingsEventsPutInvalid.status !== 400) {
      throw new Error(`settingsEventsPutInvalid status ${settingsEventsPutInvalid.status}`);
    }
    assertSchema(
      'settingsEventsPutInvalid',
      apiContract.settingsNotificationEventsPut.responses[400],
      settingsEventsPutInvalid.payload,
    );

    const settingsEventsPut = await apiRequest(
      baseUrl,
      'PUT',
      '/api/v1/settings/notifications/events',
      {
        bot_banned: true,
        bot_offline: true,
        bot_online: false,
      },
    );
    if (settingsEventsPut.status !== 200) {
      throw new Error(`settingsEventsPut status ${settingsEventsPut.status}`);
    }
    assertSchema(
      'settingsEventsPut',
      apiContract.settingsNotificationEventsPut.responses[200],
      settingsEventsPut.payload,
    );

    const themeAssetsList = await apiRequest(baseUrl, 'GET', '/api/v1/theme-assets');
    if (themeAssetsList.status !== 200) {
      throw new Error(`themeAssetsList status ${themeAssetsList.status}`);
    }
    assertSchema(
      'themeAssetsList',
      apiContract.themeAssetsList.responses[200],
      themeAssetsList.payload,
    );

    const themeAssetsPresignInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/theme-assets/presign-upload',
      {},
    );
    if (themeAssetsPresignInvalid.status !== 400) {
      throw new Error(`themeAssetsPresignInvalid status ${themeAssetsPresignInvalid.status}`);
    }
    assertSchema(
      'themeAssetsPresignInvalid',
      apiContract.themeAssetsPresignUpload.responses[400],
      themeAssetsPresignInvalid.payload,
    );

    const themeAssetsPresign = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/theme-assets/presign-upload',
      {
        filename: 'background.png',
        mime_type: 'image/png',
        size_bytes: 12345,
      },
    );
    if (themeAssetsPresign.status !== 201) {
      throw new Error(`themeAssetsPresign status ${themeAssetsPresign.status}`);
    }
    assertSchema(
      'themeAssetsPresign',
      apiContract.themeAssetsPresignUpload.responses[201],
      themeAssetsPresign.payload,
    );

    const themeAssetId = String(themeAssetsPresign.payload?.data?.asset_id || '');
    if (!themeAssetId) {
      throw new Error('themeAssetsPresign missing asset_id');
    }

    const themeAssetsCompleteInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/theme-assets/complete',
      {},
    );
    if (themeAssetsCompleteInvalid.status !== 400) {
      throw new Error(`themeAssetsCompleteInvalid status ${themeAssetsCompleteInvalid.status}`);
    }
    assertSchema(
      'themeAssetsCompleteInvalid',
      apiContract.themeAssetsComplete.responses[400],
      themeAssetsCompleteInvalid.payload,
    );

    const themeAssetsComplete = await apiRequest(baseUrl, 'POST', '/api/v1/theme-assets/complete', {
      asset_id: themeAssetId,
      width: 1920,
      height: 1080,
    });
    if (themeAssetsComplete.status !== 200) {
      throw new Error(`themeAssetsComplete status ${themeAssetsComplete.status}`);
    }
    assertSchema(
      'themeAssetsComplete',
      apiContract.themeAssetsComplete.responses[200],
      themeAssetsComplete.payload,
    );

    const themeAssetsDeleteMissing = await apiRequest(
      baseUrl,
      'DELETE',
      '/api/v1/theme-assets/missing-id',
    );
    if (themeAssetsDeleteMissing.status !== 404) {
      throw new Error(`themeAssetsDeleteMissing status ${themeAssetsDeleteMissing.status}`);
    }
    assertSchema(
      'themeAssetsDeleteMissing',
      apiContract.themeAssetsDelete.responses[404],
      themeAssetsDeleteMissing.payload,
    );

    const themeAssetsDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/theme-assets/${encodeURIComponent(themeAssetId)}`,
    );
    if (themeAssetsDelete.status !== 200) {
      throw new Error(`themeAssetsDelete status ${themeAssetsDelete.status}`);
    }
    assertSchema(
      'themeAssetsDelete',
      apiContract.themeAssetsDelete.responses[200],
      themeAssetsDelete.payload,
    );

    const resourcesCreate = await apiRequest(baseUrl, 'POST', '/api/v1/resources/licenses', {
      key: 'ABC-123',
      status: 'active',
    });
    if (resourcesCreate.status !== 201)
      throw new Error(`resourcesCreate status ${resourcesCreate.status}`);
    assertSchema(
      'resourcesCreate',
      apiContract.resourcesCreate.responses[201],
      resourcesCreate.payload,
    );
    const createdResourceId = String(resourcesCreate.payload?.data?.id || '');
    if (!createdResourceId) throw new Error('resourcesCreate missing id');

    const resourcesList = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/resources/licenses?page=1&limit=10',
    );
    if (resourcesList.status !== 200)
      throw new Error(`resourcesList status ${resourcesList.status}`);
    assertSchema('resourcesList', apiContract.resourcesList.responses[200], resourcesList.payload);

    const resourcesGet = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/resources/licenses/${encodeURIComponent(createdResourceId)}`,
    );
    if (resourcesGet.status !== 200) throw new Error(`resourcesGet status ${resourcesGet.status}`);
    assertSchema('resourcesGet', apiContract.resourcesGet.responses[200], resourcesGet.payload);

    const resourcesUpdate = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/resources/licenses/${encodeURIComponent(createdResourceId)}`,
      { status: 'revoked' },
    );
    if (resourcesUpdate.status !== 200)
      throw new Error(`resourcesUpdate status ${resourcesUpdate.status}`);
    assertSchema(
      'resourcesUpdate',
      apiContract.resourcesUpdate.responses[200],
      resourcesUpdate.payload,
    );

    const financeCreateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/finance/operations',
      {},
    );
    if (financeCreateInvalid.status !== 400) {
      throw new Error(`financeCreateInvalid status ${financeCreateInvalid.status}`);
    }
    assertSchema(
      'financeCreateInvalid',
      apiContract.financeOperationsCreate.responses[400],
      financeCreateInvalid.payload,
    );

    const financeCreate = await apiRequest(baseUrl, 'POST', '/api/v1/finance/operations', {
      type: 'income',
      category: 'sale',
      amount: 120,
      currency: 'USD',
      date: Date.now(),
      description: 'Gold sale batch',
      project_id: 'wow_tbc',
      gold_price_at_time: 12.5,
    });
    if (financeCreate.status !== 201) {
      throw new Error(`financeCreate status ${financeCreate.status}`);
    }
    assertSchema(
      'financeCreate',
      apiContract.financeOperationsCreate.responses[201],
      financeCreate.payload,
    );
    const createdFinanceId = String(financeCreate.payload?.data?.id || '');
    if (!createdFinanceId) throw new Error('financeCreate missing id');

    const financeList = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/finance/operations?page=1&limit=10',
    );
    if (financeList.status !== 200) {
      throw new Error(`financeList status ${financeList.status}`);
    }
    assertSchema(
      'financeList',
      apiContract.financeOperationsList.responses[200],
      financeList.payload,
    );

    const financeGet = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/finance/operations/${encodeURIComponent(createdFinanceId)}`,
    );
    if (financeGet.status !== 200) {
      throw new Error(`financeGet status ${financeGet.status}`);
    }
    assertSchema('financeGet', apiContract.financeOperationsGet.responses[200], financeGet.payload);

    const financePatch = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/finance/operations/${encodeURIComponent(createdFinanceId)}`,
      { amount: 150 },
    );
    if (financePatch.status !== 200) {
      throw new Error(`financePatch status ${financePatch.status}`);
    }
    assertSchema(
      'financePatch',
      apiContract.financeOperationsPatch.responses[200],
      financePatch.payload,
    );

    const financeMissing = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/finance/operations/missing-finance',
    );
    if (financeMissing.status !== 404) {
      throw new Error(`financeMissing status ${financeMissing.status}`);
    }
    assertSchema(
      'financeMissing',
      apiContract.financeOperationsGet.responses[404],
      financeMissing.payload,
    );

    const financeDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/finance/operations/${encodeURIComponent(createdFinanceId)}`,
    );
    if (financeDelete.status !== 200) {
      throw new Error(`financeDelete status ${financeDelete.status}`);
    }
    assertSchema(
      'financeDelete',
      apiContract.financeOperationsDelete.responses[200],
      financeDelete.payload,
    );

    const financeDailyStats = await apiRequest(baseUrl, 'GET', '/api/v1/finance/daily-stats');
    if (financeDailyStats.status !== 200) {
      throw new Error(`financeDailyStats status ${financeDailyStats.status}`);
    }
    assertSchema(
      'financeDailyStats',
      apiContract.financeDailyStats.responses[200],
      financeDailyStats.payload,
    );

    const financeGoldPriceHistory = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/finance/gold-price-history',
    );
    if (financeGoldPriceHistory.status !== 200) {
      throw new Error(`financeGoldPriceHistory status ${financeGoldPriceHistory.status}`);
    }
    assertSchema(
      'financeGoldPriceHistory',
      apiContract.financeGoldPriceHistory.responses[200],
      financeGoldPriceHistory.payload,
    );

    const playbooksCreateInvalid = await apiRequest(baseUrl, 'POST', '/api/v1/playbooks', {});
    if (playbooksCreateInvalid.status !== 400) {
      throw new Error(`playbooksCreateInvalid status ${playbooksCreateInvalid.status}`);
    }
    assertSchema(
      'playbooksCreateInvalid',
      apiContract.playbooksCreate.responses[400],
      playbooksCreateInvalid.payload,
    );

    const playbooksCreateInvalidYaml = await apiRequest(baseUrl, 'POST', '/api/v1/playbooks', {
      name: 'bad-playbook',
      content: 'plain text without yaml markers',
    });
    if (playbooksCreateInvalidYaml.status !== 422) {
      throw new Error(`playbooksCreateInvalidYaml status ${playbooksCreateInvalidYaml.status}`);
    }
    assertSchema(
      'playbooksCreateInvalidYaml',
      apiContract.playbooksCreate.responses[422],
      playbooksCreateInvalidYaml.payload,
    );

    const playbooksCreate = await apiRequest(baseUrl, 'POST', '/api/v1/playbooks', {
      name: 'starter',
      is_default: true,
      content: 'name: starter\nroles:\n  - role: base-system\n',
    });
    if (playbooksCreate.status !== 201) {
      throw new Error(`playbooksCreate status ${playbooksCreate.status}`);
    }
    assertSchema(
      'playbooksCreate',
      apiContract.playbooksCreate.responses[201],
      playbooksCreate.payload,
    );
    const createdPlaybookId = String(playbooksCreate.payload?.data?.id || '');
    if (!createdPlaybookId) throw new Error('playbooksCreate missing id');

    const playbooksList = await apiRequest(baseUrl, 'GET', '/api/v1/playbooks');
    if (playbooksList.status !== 200) {
      throw new Error(`playbooksList status ${playbooksList.status}`);
    }
    assertSchema('playbooksList', apiContract.playbooksList.responses[200], playbooksList.payload);

    const playbooksGet = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/playbooks/${encodeURIComponent(createdPlaybookId)}`,
    );
    if (playbooksGet.status !== 200) {
      throw new Error(`playbooksGet status ${playbooksGet.status}`);
    }
    assertSchema('playbooksGet', apiContract.playbooksGet.responses[200], playbooksGet.payload);

    const playbooksUpdateNoop = await apiRequest(
      baseUrl,
      'PUT',
      `/api/v1/playbooks/${encodeURIComponent(createdPlaybookId)}`,
      {},
    );
    if (playbooksUpdateNoop.status !== 200) {
      throw new Error(`playbooksUpdateNoop status ${playbooksUpdateNoop.status}`);
    }
    assertSchema(
      'playbooksUpdateNoop',
      apiContract.playbooksUpdate.responses[200],
      playbooksUpdateNoop.payload,
    );

    const playbooksUpdateInvalidYaml = await apiRequest(
      baseUrl,
      'PUT',
      `/api/v1/playbooks/${encodeURIComponent(createdPlaybookId)}`,
      { content: 'still not yaml content' },
    );
    if (playbooksUpdateInvalidYaml.status !== 422) {
      throw new Error(`playbooksUpdateInvalidYaml status ${playbooksUpdateInvalidYaml.status}`);
    }
    assertSchema(
      'playbooksUpdateInvalidYaml',
      apiContract.playbooksUpdate.responses[422],
      playbooksUpdateInvalidYaml.payload,
    );

    const playbooksUpdate = await apiRequest(
      baseUrl,
      'PUT',
      `/api/v1/playbooks/${encodeURIComponent(createdPlaybookId)}`,
      {
        name: 'starter-updated',
        content: 'name: starter-updated\nroles:\n  - role: base-system\n',
      },
    );
    if (playbooksUpdate.status !== 200) {
      throw new Error(`playbooksUpdate status ${playbooksUpdate.status}`);
    }
    assertSchema(
      'playbooksUpdate',
      apiContract.playbooksUpdate.responses[200],
      playbooksUpdate.payload,
    );

    const playbooksGetMissing = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/playbooks/missing-playbook',
    );
    if (playbooksGetMissing.status !== 404) {
      throw new Error(`playbooksGetMissing status ${playbooksGetMissing.status}`);
    }
    assertSchema(
      'playbooksGetMissing',
      apiContract.playbooksGet.responses[404],
      playbooksGetMissing.payload,
    );

    const playbooksValidateInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/playbooks/validate',
      {},
    );
    if (playbooksValidateInvalid.status !== 400) {
      throw new Error(`playbooksValidateInvalid status ${playbooksValidateInvalid.status}`);
    }
    assertSchema(
      'playbooksValidateInvalid',
      apiContract.playbooksValidate.responses[400],
      playbooksValidateInvalid.payload,
    );

    const playbooksValidate = await apiRequest(baseUrl, 'POST', '/api/v1/playbooks/validate', {
      content: 'name: validated\nroles:\n  - role: base-system\n',
    });
    if (playbooksValidate.status !== 200) {
      throw new Error(`playbooksValidate status ${playbooksValidate.status}`);
    }
    assertSchema(
      'playbooksValidate',
      apiContract.playbooksValidate.responses[200],
      playbooksValidate.payload,
    );

    const playbooksDelete = await apiRequest(
      baseUrl,
      'DELETE',
      `/api/v1/playbooks/${encodeURIComponent(createdPlaybookId)}`,
    );
    if (playbooksDelete.status !== 200) {
      throw new Error(`playbooksDelete status ${playbooksDelete.status}`);
    }
    assertSchema(
      'playbooksDelete',
      apiContract.playbooksDelete.responses[200],
      playbooksDelete.payload,
    );

    const wowNamesBatches = await apiRequest(baseUrl, 'GET', '/api/v1/wow-names?batches=3');
    if (wowNamesBatches.status !== 200) {
      throw new Error(`wowNamesBatches status ${wowNamesBatches.status}`);
    }
    assertSchema(
      'wowNamesBatches',
      apiContract.wowNamesGet.responses[200],
      wowNamesBatches.payload,
    );

    const wowNamesCount = await apiRequest(baseUrl, 'GET', '/api/v1/wow-names?count=3');
    if (wowNamesCount.status !== 200) {
      throw new Error(`wowNamesCount status ${wowNamesCount.status}`);
    }
    assertSchema('wowNamesCount', apiContract.wowNamesGet.responses[200], wowNamesCount.payload);

    const wowNamesInvalidQuery = await apiRequest(baseUrl, 'GET', '/api/v1/wow-names?count=abc');
    if (wowNamesInvalidQuery.status !== 400) {
      throw new Error(`wowNamesInvalidQuery status ${wowNamesInvalidQuery.status}`);
    }
    assertSchema(
      'wowNamesInvalidQuery',
      apiContract.wowNamesGet.responses[400],
      wowNamesInvalidQuery.payload,
    );

    const ipqsStatus = await apiRequest(baseUrl, 'GET', '/api/v1/ipqs/status');
    if (ipqsStatus.status !== 200) {
      throw new Error(`ipqsStatus status ${ipqsStatus.status}`);
    }
    assertSchema('ipqsStatus', apiContract.ipqsStatusGet.responses[200], ipqsStatus.payload);

    const ipqsCheckInvalid = await apiRequest(baseUrl, 'POST', '/api/v1/ipqs/check', {});
    if (ipqsCheckInvalid.status !== 400) {
      throw new Error(`ipqsCheckInvalid status ${ipqsCheckInvalid.status}`);
    }
    assertSchema(
      'ipqsCheckInvalid',
      apiContract.ipqsCheck.responses[400],
      ipqsCheckInvalid.payload,
    );

    const ipqsCheck = await apiRequest(baseUrl, 'POST', '/api/v1/ipqs/check', {
      ip: '8.8.8.8',
    });
    if (ipqsCheck.status !== 200) {
      throw new Error(`ipqsCheck status ${ipqsCheck.status}`);
    }
    assertSchema('ipqsCheck', apiContract.ipqsCheck.responses[200], ipqsCheck.payload);

    const ipqsBatchInvalid = await apiRequest(baseUrl, 'POST', '/api/v1/ipqs/check-batch', {});
    if (ipqsBatchInvalid.status !== 400) {
      throw new Error(`ipqsBatchInvalid status ${ipqsBatchInvalid.status}`);
    }
    assertSchema(
      'ipqsBatchInvalid',
      apiContract.ipqsCheckBatch.responses[400],
      ipqsBatchInvalid.payload,
    );

    const ipqsBatch = await apiRequest(baseUrl, 'POST', '/api/v1/ipqs/check-batch', {
      ips: ['8.8.8.8', '1.1.1.1', 'invalid-ip'],
    });
    if (ipqsBatch.status !== 200) {
      throw new Error(`ipqsBatch status ${ipqsBatch.status}`);
    }
    assertSchema('ipqsBatch', apiContract.ipqsCheckBatch.responses[200], ipqsBatch.payload);

    const agentsPairing = await apiRequest(baseUrl, 'POST', '/api/v1/agents/pairings', {
      name: 'test-agent',
      expires_in_minutes: 30,
    });
    if (agentsPairing.status !== 201)
      throw new Error(`agentsPairing status ${agentsPairing.status}`);
    assertSchema(
      'agentsCreatePairing',
      apiContract.agentsCreatePairing.responses[201],
      agentsPairing.payload,
    );

    const agentsHeartbeat = await apiRequest(baseUrl, 'POST', '/api/v1/agents/heartbeat', {
      agent_id: 'agent-1',
    });
    if (agentsHeartbeat.status !== 200)
      throw new Error(`agentsHeartbeat status ${agentsHeartbeat.status}`);
    assertSchema(
      'agentsHeartbeat',
      apiContract.agentsHeartbeat.responses[200],
      agentsHeartbeat.payload,
    );

    const agentsList = await apiRequest(baseUrl, 'GET', '/api/v1/agents?status=active');
    if (agentsList.status !== 200) throw new Error(`agentsList status ${agentsList.status}`);
    assertSchema('agentsList', apiContract.agentsList.responses[200], agentsList.payload);

    const agentsListInvalid = await apiRequest(baseUrl, 'GET', '/api/v1/agents?status=unknown');
    if (agentsListInvalid.status !== 400)
      throw new Error(`agentsListInvalid status ${agentsListInvalid.status}`);
    assertSchema(
      'agentsListInvalid',
      apiContract.agentsList.responses[400],
      agentsListInvalid.payload,
    );

    const licenseLeaseInvalid = await apiRequest(baseUrl, 'POST', '/api/v1/license/lease', {});
    if (licenseLeaseInvalid.status !== 400) {
      throw new Error(`licenseLeaseInvalid status ${licenseLeaseInvalid.status}`);
    }
    assertSchema(
      'licenseLeaseInvalid',
      apiContract.licenseLease.responses[400],
      licenseLeaseInvalid.payload,
    );

    const licenseLease = await apiRequest(baseUrl, 'POST', '/api/v1/license/lease', {
      vm_uuid: 'vm-demo-001',
      user_id: 'user-1',
      agent_id: 'agent-1',
      runner_id: 'runner-1',
      module: 'core',
      version: '1.0.0',
    });
    if (licenseLease.status !== 201) {
      throw new Error(`licenseLease status ${licenseLease.status}`);
    }
    assertSchema('licenseLease', apiContract.licenseLease.responses[201], licenseLease.payload);
    const leaseId = String(licenseLease.payload?.data?.lease_id || '');
    if (!leaseId) {
      throw new Error('licenseLease missing lease_id');
    }

    const licenseHeartbeatInvalid = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/license/heartbeat',
      {},
    );
    if (licenseHeartbeatInvalid.status !== 400) {
      throw new Error(`licenseHeartbeatInvalid status ${licenseHeartbeatInvalid.status}`);
    }
    assertSchema(
      'licenseHeartbeatInvalid',
      apiContract.licenseHeartbeat.responses[400],
      licenseHeartbeatInvalid.payload,
    );

    const licenseHeartbeat = await apiRequest(baseUrl, 'POST', '/api/v1/license/heartbeat', {
      lease_id: leaseId,
    });
    if (licenseHeartbeat.status !== 200) {
      throw new Error(`licenseHeartbeat status ${licenseHeartbeat.status}`);
    }
    assertSchema(
      'licenseHeartbeat',
      apiContract.licenseHeartbeat.responses[200],
      licenseHeartbeat.payload,
    );

    const licenseRevokeMissing = await apiRequest(baseUrl, 'POST', '/api/v1/license/revoke', {
      lease_id: 'missing-lease',
    });
    if (licenseRevokeMissing.status !== 404) {
      throw new Error(`licenseRevokeMissing status ${licenseRevokeMissing.status}`);
    }
    assertSchema(
      'licenseRevokeMissing',
      apiContract.licenseRevoke.responses[404],
      licenseRevokeMissing.payload,
    );

    const licenseRevoke = await apiRequest(baseUrl, 'POST', '/api/v1/license/revoke', {
      lease_id: leaseId,
      reason: 'manual revoke',
    });
    if (licenseRevoke.status !== 200) {
      throw new Error(`licenseRevoke status ${licenseRevoke.status}`);
    }
    assertSchema('licenseRevoke', apiContract.licenseRevoke.responses[200], licenseRevoke.payload);

    const vmDispatchInvalid = await apiRequest(baseUrl, 'POST', '/api/v1/vm-ops/proxmox/start', {});
    if (vmDispatchInvalid.status !== 400)
      throw new Error(`vmDispatchInvalid status ${vmDispatchInvalid.status}`);
    assertSchema(
      'vmOpsDispatchProxmoxInvalid',
      apiContract.vmOpsDispatchProxmox.responses[400],
      vmDispatchInvalid.payload,
    );

    const vmDispatchInvalidAction = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/vm-ops/proxmox/%20',
      { agent_id: 'agent-1', params: {} },
    );
    if (vmDispatchInvalidAction.status !== 400) {
      throw new Error(`vmDispatchInvalidAction status ${vmDispatchInvalidAction.status}`);
    }
    assertSchema(
      'vmOpsDispatchProxmoxInvalidAction',
      apiContract.vmOpsDispatchProxmox.responses[400],
      vmDispatchInvalidAction.payload,
    );

    const vmDispatch = await apiRequest(baseUrl, 'POST', '/api/v1/vm-ops/proxmox/start', {
      agent_id: 'agent-1',
      params: { vmid: 100 },
    });
    if (vmDispatch.status !== 202) throw new Error(`vmDispatch status ${vmDispatch.status}`);
    assertSchema(
      'vmOpsDispatchProxmox',
      apiContract.vmOpsDispatchProxmox.responses[202],
      vmDispatch.payload,
    );
    const commandId = String(vmDispatch.payload?.data?.id || '');
    if (!commandId) throw new Error('vmDispatch missing command id');

    const vmDispatchSyncthing = await apiRequest(
      baseUrl,
      'POST',
      '/api/v1/vm-ops/syncthing/status',
      {
        agent_id: 'agent-1',
        params: {},
      },
    );
    if (vmDispatchSyncthing.status !== 202)
      throw new Error(`vmDispatchSyncthing status ${vmDispatchSyncthing.status}`);
    assertSchema(
      'vmOpsDispatchSyncthing',
      apiContract.vmOpsDispatchSyncthing.responses[202],
      vmDispatchSyncthing.payload,
    );

    const vmCommand = await apiRequest(
      baseUrl,
      'GET',
      `/api/v1/vm-ops/commands/${encodeURIComponent(commandId)}`,
    );
    if (vmCommand.status !== 200) throw new Error(`vmCommand status ${vmCommand.status}`);
    assertSchema(
      'vmOpsCommandById',
      apiContract.vmOpsCommandById.responses[200],
      vmCommand.payload,
    );

    const vmCommandNextForbidden = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/vm-ops/commands/next?agent_id=agent-1',
    );
    if (vmCommandNextForbidden.status !== 403) {
      throw new Error(`vmCommandNextForbidden status ${vmCommandNextForbidden.status}`);
    }
    assertSchema(
      'vmOpsCommandNextForbidden',
      apiContract.vmOpsCommandNext.responses[403],
      vmCommandNextForbidden.payload,
    );

    const vmCommandNext = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/vm-ops/commands/next?agent_id=agent-1&timeout_ms=1000',
      undefined,
      {
        'x-test-auth-source': 'agent',
        'x-test-agent-id': 'agent-1',
      },
    );
    if (vmCommandNext.status !== 200) {
      throw new Error(`vmCommandNext status ${vmCommandNext.status}`);
    }
    assertSchema(
      'vmOpsCommandNext',
      apiContract.vmOpsCommandNext.responses[200],
      vmCommandNext.payload,
    );

    const vmCommandNextInvalidTimeout = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/vm-ops/commands/next?agent_id=agent-1&timeout_ms=abc',
      undefined,
      {
        'x-test-auth-source': 'agent',
        'x-test-agent-id': 'agent-1',
      },
    );
    if (vmCommandNextInvalidTimeout.status !== 200) {
      throw new Error(`vmCommandNextInvalidTimeout status ${vmCommandNextInvalidTimeout.status}`);
    }
    assertSchema(
      'vmOpsCommandNextInvalidTimeout',
      apiContract.vmOpsCommandNext.responses[200],
      vmCommandNextInvalidTimeout.payload,
    );

    const vmCommandPatchInvalid = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/vm-ops/commands/${encodeURIComponent(commandId)}`,
      {},
      {
        'x-test-auth-source': 'agent',
        'x-test-agent-id': 'agent-1',
      },
    );
    if (vmCommandPatchInvalid.status !== 400) {
      throw new Error(`vmCommandPatchInvalid status ${vmCommandPatchInvalid.status}`);
    }
    assertSchema(
      'vmOpsCommandPatchInvalid',
      apiContract.vmOpsCommandPatch.responses[400],
      vmCommandPatchInvalid.payload,
    );

    const vmCommandPatch = await apiRequest(
      baseUrl,
      'PATCH',
      `/api/v1/vm-ops/commands/${encodeURIComponent(commandId)}`,
      {
        status: 'running',
        result: { step: 'started' },
      },
      {
        'x-test-auth-source': 'agent',
        'x-test-agent-id': 'agent-1',
      },
    );
    if (vmCommandPatch.status !== 200) {
      throw new Error(`vmCommandPatch status ${vmCommandPatch.status}`);
    }
    assertSchema(
      'vmOpsCommandPatch',
      apiContract.vmOpsCommandPatch.responses[200],
      vmCommandPatch.payload,
    );

    const vmCommandPatchMissing = await apiRequest(
      baseUrl,
      'PATCH',
      '/api/v1/vm-ops/commands/missing-command',
      {
        status: 'failed',
        error_message: 'missing',
      },
      {
        'x-test-auth-source': 'agent',
        'x-test-agent-id': 'agent-1',
      },
    );
    if (vmCommandPatchMissing.status !== 404) {
      throw new Error(`vmCommandPatchMissing status ${vmCommandPatchMissing.status}`);
    }
    assertSchema(
      'vmOpsCommandPatchMissing',
      apiContract.vmOpsCommandPatch.responses[404],
      vmCommandPatchMissing.payload,
    );

    const vmCommandMissing = await apiRequest(
      baseUrl,
      'GET',
      '/api/v1/vm-ops/commands/missing-command',
    );
    if (vmCommandMissing.status !== 404)
      throw new Error(`vmCommandMissing status ${vmCommandMissing.status}`);
    assertSchema(
      'vmOpsCommandByIdMissing',
      apiContract.vmOpsCommandById.responses[404],
      vmCommandMissing.payload,
    );
  });

  process.stdout.write('Legacy contract parity check passed for migrated modules.\n');
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});

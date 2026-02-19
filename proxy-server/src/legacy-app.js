/**
 * IPQualityScore Proxy Server
 * Локальный Express.js сервер для проксирования запросов к IPQualityScore API
 * Решает проблему CORS для локальной разработки
 */

// Load .env before importing modules that snapshot process.env.
try {
  require('dotenv').config();
} catch {
  // .env not required, continue without it
}

const express = require('express');
const { env } = require('./config/env');
const { createApiV1Router } = require('./modules/v1');
const { createAuthMiddleware } = require('./middleware/auth');
const { attachVmOperationsWebSocket } = require('./modules/infra/vm-operations-ws');
const { createInfraConnectors } = require('./modules/infra/connectors');
const { createUiProxyStack } = require('./modules/infra/ui-proxy-stack');
const { mountUiProxyRoutes } = require('./modules/infra/ui-proxy-routes');
const { attachUiProxyUpgradeHandler } = require('./modules/infra/ui-proxy-upgrade');
const { createUiServiceAuth } = require('./modules/infra/ui-service-auth');
const {
  createUiServiceFallbackMiddleware,
  createProxmoxUiCatchAllMiddleware,
} = require('./modules/infra/ui-fallback-middleware');
const { createIpqsService } = require('./modules/ipqs/service');
const wowNamesService = require('./modules/wow-names/service');
const { startServerRuntime } = require('./bootstrap/runtime');
const { createNestStranglerMiddleware } = require('./bootstrap/nest-strangler');
const { logger } = require('./observability/logger');
const { createUiTargets } = require('./bootstrap/ui-targets');
const { createAppSettingsReader } = require('./repositories/supabase/app-settings-reader');
const {
  createCorsOptions,
  mountCoreHttpMiddleware,
  mountLegacyErrorHandlers,
} = require('./bootstrap/http-middleware');

const app = express();
const PORT = env.port || process.env.PORT || 3001;
const authMiddleware = createAuthMiddleware({
  env,
});
const settingsReader = createAppSettingsReader({ env });

async function authorizeInfraRequest(req) {
  const authResult = await authMiddleware.authenticateRequest(req, {
    allowQueryToken: true,
  });
  if (!authResult.ok) {
    return authResult;
  }

  if (!authMiddleware.hasRole(authResult.auth, 'infra')) {
    return authMiddleware.makeAuthError(403, "Role 'infra' is required for this endpoint");
  }

  req.auth = authResult.auth;
  return authResult;
}

const corsOptions = createCorsOptions(env);
const uiTargets = createUiTargets();

const { proxmoxAgent, proxmoxSession, proxmoxLogin, proxmoxRequest, sshExec } =
  createInfraConnectors({
    settingsReader,
    setProxmoxTarget: uiTargets.setProxmoxTarget,
  });

const uiServiceAuth = createUiServiceAuth({
  settingsReader,
  httpsAgent: proxmoxAgent,
});

const {
  tinyFMSession,
  syncThingSession,
  normalizeBaseUrl,
  getVMServiceSettings,
  ensureTinyFMLogin,
  ensureSyncThingLogin,
  resolveSyncThingUrl,
} = uiServiceAuth;

const {
  proxmoxUIProxy,
  tinyFMUIProxy,
  syncThingUIProxy,
  appendCookieHeader,
  upsertCookieHeader,
  normalizeProxmoxCapShape,
  inferUiService,
} = createUiProxyStack({
  proxmoxSession,
  updateCookieHeader: uiServiceAuth.updateCookieHeader,
  getProxmoxTarget: uiTargets.getProxmoxTarget,
  getTinyFmTarget: uiTargets.getTinyFmTarget,
  getSyncThingTarget: uiTargets.getSyncThingTarget,
});

// These routes MUST be registered before express.json() — raw body must pass through untouched.
mountUiProxyRoutes({
  app,
  authorizeRequest: authorizeInfraRequest,
  proxmoxLogin,
  normalizeProxmoxCapShape,
  proxmoxSession,
  upsertCookieHeader,
  proxmoxUIProxy,
  getProxmoxTarget: uiTargets.getProxmoxTarget,
  getVMServiceSettings,
  normalizeBaseUrl,
  ensureTinyFMLogin,
  appendCookieHeader,
  tinyFMSession,
  tinyFMUIProxy,
  setTinyFmTarget: uiTargets.setTinyFmTarget,
  resolveSyncThingUrl,
  ensureSyncThingLogin,
  syncThingSession,
  syncThingUIProxy,
  setSyncThingTarget: uiTargets.setSyncThingTarget,
});

mountCoreHttpMiddleware({
  app,
  env,
  corsOptions,
});

const ipqsService = createIpqsService({
  settingsReader,
});

const nestStranglerMiddleware = createNestStranglerMiddleware({
  env,
  logger,
});

// Canonical API v1.
app.use(
  '/api/v1',
  nestStranglerMiddleware,
  createApiV1Router({
    authMiddleware,
    env,
    proxmoxLogin,
    proxmoxRequest,
    sshExec,
    ipqsService,
    wowNamesService,
  }),
);

// Service-aware fallback for root-level absolute assets/API calls inside proxied iframes.
// TinyFM/SyncThing often request "/rest/*" or "/css/*" without prefix.
app.use(
  createUiServiceFallbackMiddleware({
    authorizeRequest: authorizeInfraRequest,
    inferUiService,
    getVMServiceSettings,
    normalizeBaseUrl,
    resolveSyncThingUrl,
    ensureTinyFMLogin,
    ensureSyncThingLogin,
    appendCookieHeader,
    tinyFMSession,
    syncThingSession,
    tinyFMUIProxy,
    syncThingUIProxy,
    getTinyFmTarget: uiTargets.getTinyFmTarget,
    setTinyFmTarget: uiTargets.setTinyFmTarget,
    getSyncThingTarget: uiTargets.getSyncThingTarget,
    setSyncThingTarget: uiTargets.setSyncThingTarget,
  }),
);

// Catch-all: proxy any unmatched request to Proxmox (for iframe assets at unpredictable paths)
// This must be AFTER all our /api/* routes but BEFORE the 404 handler.
app.use(
  createProxmoxUiCatchAllMiddleware({
    authorizeRequest: authorizeInfraRequest,
    proxmoxUIProxy,
    getProxmoxTarget: uiTargets.getProxmoxTarget,
  }),
);

mountLegacyErrorHandlers(app);

startServerRuntime({
  app,
  port: PORT,
  corsOptions,
  logger,
  attachUiProxyUpgradeHandler,
  attachUiProxyUpgradeParams: {
    authorizeUpgradeRequest: authorizeInfraRequest,
    proxmoxUIProxy,
    tinyFMUIProxy,
    syncThingUIProxy,
    proxmoxSession,
    tinyFMSession,
    syncThingSession,
    upsertCookieHeader,
    appendCookieHeader,
    inferUiService,
    getProxmoxTarget: uiTargets.getProxmoxTarget,
    getTinyFmTarget: uiTargets.getTinyFmTarget,
    getSyncThingTarget: uiTargets.getSyncThingTarget,
  },
  attachVmOperationsWebSocket,
  attachVmOperationsParams: {
    authorizeSocketRequest: authorizeInfraRequest,
    proxmoxRequest,
    sshExec,
    getDefaultNode: () => proxmoxSession.node,
  },
});

module.exports = app;

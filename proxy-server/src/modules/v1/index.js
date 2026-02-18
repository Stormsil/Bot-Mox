const express = require('express');
const { env } = require('../../config/env');
const { success, failure } = require('../../contracts/envelope');
const { createAuthMiddleware } = require('../../middleware/auth');
const { createAuthRoutes } = require('./auth.routes');
const { createResourcesRoutes } = require('./resources.routes');
const { createWorkspaceRoutes } = require('./workspace.routes');
const { createSettingsRoutes } = require('./settings.routes');
const { createBotsRoutes } = require('./bots.routes');
const { createInfraRoutes } = require('./infra.routes');
const { createFinanceRoutes } = require('./finance.routes');
const { createIpqsRoutes } = require('./ipqs.routes');
const { createWowNamesRoutes } = require('./wow-names.routes');
const { createVmRoutes } = require('./vm.routes');
const { createLicenseRoutes } = require('./license.routes');
const { createArtifactsRoutes } = require('./artifacts.routes');
const { createAgentsRoutes } = require('./agents.routes');
const { createSecretsRoutes } = require('./secrets.routes');
const { createVmOpsRoutes } = require('./vm-ops.routes');
const { createThemeAssetsRoutes } = require('./theme-assets.routes');
const { createProvisioningRoutes } = require('./provisioning.routes');
const { createPlaybookRoutes } = require('./playbooks.routes');
const { createOtelProxyRoutes } = require('./otel.routes');
const { createDiagnosticsRoutes } = require('./diagnostics.routes');
const { createClientLogsRoutes } = require('./client-logs.routes');
const { createVmRegistryService } = require('../vm-registry/service');
const { createLicenseService } = require('../license/service');
const { createArtifactsService } = require('../artifacts/service');
const { createAgentService } = require('../agents/service');
const { createSecretsService } = require('../secrets/service');
const { createVmOpsService } = require('../vm-ops/service');
const { createThemeAssetsService } = require('../theme-assets/service');
const { createProvisioningService } = require('../provisioning/service');
const { createProvisioningS3Service } = require('../provisioning/s3-service');
const { createPlaybookService } = require('../playbooks/service');
const { createRepositories } = require('../../repositories/repository-factory');
const { createAuditLogMiddleware } = require('../../middleware/audit-log');
const { asyncHandler } = require('./helpers');
const {
  getHealthChecks,
  buildHealthPayload,
  buildLivenessPayload,
  buildReadinessPayload,
} = require('./health');

function createApiV1Router({
  env: injectedEnv,
  proxmoxLogin,
  proxmoxRequest,
  sshExec,
  ipqsService,
  wowNamesService,
  authMiddleware: injectedAuthMiddleware,
}) {
  const runtimeEnv = injectedEnv || env;
  const router = express.Router();
  const authMiddleware = injectedAuthMiddleware || createAuthMiddleware({ env: runtimeEnv });
  const { authenticate, requireRole } = authMiddleware;
  const repos = createRepositories({ env: runtimeEnv });
  const vmRegistryService = createVmRegistryService({ env: runtimeEnv });
  const licenseService = createLicenseService({
    env: runtimeEnv,
    vmRegistryService,
  });
  const artifactsService = createArtifactsService({
    env: runtimeEnv,
    licenseService,
  });
  const agentService = createAgentService({ env: runtimeEnv });
  const secretsService = createSecretsService({ env: runtimeEnv });
  const vmOpsService = createVmOpsService({ env: runtimeEnv, agentService });
  const themeAssetsService = createThemeAssetsService({ env: runtimeEnv });
  const provisioningService = createProvisioningService({ env: runtimeEnv });
  const provisioningS3Service = createProvisioningS3Service({ env: runtimeEnv });
  const playbookService = createPlaybookService({ env: runtimeEnv });

  function isPublicAgentBootstrap(req) {
    const method = String(req?.method || '').toUpperCase();
    const path = String(req?.path || '').trim();
    if (method !== 'POST') return false;
    return path === '/agents/register' || path === '/agents/quick-pair';
  }

  function isPublicProvisioningEndpoint(req) {
    const method = String(req?.method || '').toUpperCase();
    const path = String(req?.path || '').trim();
    if (method !== 'POST') return false;
    return path === '/provisioning/validate-token' || path === '/provisioning/report-progress';
  }

  router.get('/health/live', (_req, res) => {
    res.json(success(buildLivenessPayload()));
  });

  router.get(
    '/health/ready',
    asyncHandler(async (_req, res) => {
      const checks = await getHealthChecks({ env: runtimeEnv });
      const payload = buildReadinessPayload({ checks });
      const statusCode = payload.ready ? 200 : 503;
      res.status(statusCode).json(success(payload));
    })
  );

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const checks = await getHealthChecks({ env: runtimeEnv });
      res.json(success(buildHealthPayload({ env: runtimeEnv, checks })));
    })
  );

  // Optional OTLP proxy for browser traces (enabled via BOTMOX_OTEL_PROXY_ENABLED=1).
  router.use('/otel', createOtelProxyRoutes());
  // Dev-only diagnostics helpers (enabled via BOTMOX_DIAGNOSTICS_ENABLED=1).
  router.use('/diag', createDiagnosticsRoutes({ env: runtimeEnv }));
  // Optional frontend log intake for AI incident correlation.
  router.use('/client-logs', createClientLogsRoutes({ authMiddleware }));

  router.use('/auth', createAuthRoutes({ authenticate }));
  router.use(asyncHandler(async (req, res, next) => {
    if (isPublicAgentBootstrap(req)) {
      const optionalAuth = await authMiddleware.authenticateRequest(req, { allowQueryToken: false });
      if (optionalAuth?.ok) {
        req.auth = optionalAuth.auth;
      }
      return next();
    }

    // VM provisioning endpoints use their own token auth (in request body)
    if (isPublicProvisioningEndpoint(req)) {
      return next();
    }

    return authenticate(req, res, next);
  }));

  router.use('/resources', createResourcesRoutes({ repositories: repos.resources }));
  router.use('/workspace', createWorkspaceRoutes({ repositories: repos.workspace }));
  router.use('/settings', createSettingsRoutes({ repo: repos.settings }));
  router.use('/bots', createBotsRoutes({ repo: repos.bots }));
  router.use('/finance', createFinanceRoutes({ repo: repos.finance }));
  router.use('/vm', createVmRoutes({ vmRegistryService }));
  router.use('/license', createLicenseRoutes({ licenseService, authMiddleware }));
  router.use('/artifacts', createArtifactsRoutes({ artifactsService, authMiddleware }));
  router.use('/agents', createAgentsRoutes({ agentService, authMiddleware, env: runtimeEnv }));
  router.use('/secrets', createSecretsRoutes({ secretsService, authMiddleware }));
  router.use('/vm-ops', createVmOpsRoutes({ vmOpsService, authMiddleware }));
  router.use('/theme-assets', createThemeAssetsRoutes({ themeAssetsService }));
  router.use('/', createProvisioningRoutes({ provisioningService, playbookService, s3Service: provisioningS3Service, env: runtimeEnv }));
  router.use('/playbooks', createPlaybookRoutes({ playbookService }));
  if (ipqsService) {
    router.use('/ipqs', createIpqsRoutes({ ipqsService }));
  }
  if (wowNamesService) {
    router.use('/wow-names', createWowNamesRoutes({ wowNamesService }));
  }
  router.use(
    '/infra',
    requireRole('infra'),
    createAuditLogMiddleware({
      scope: 'api.v1.infra',
      methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    }),
    createInfraRoutes({ proxmoxLogin, proxmoxRequest, sshExec, env: runtimeEnv })
  );

  router.use((req, res) => {
    res.status(404).json(failure('NOT_FOUND', `Unknown API v1 endpoint: ${req.method} ${req.originalUrl}`));
  });

  return router;
}

module.exports = {
  createApiV1Router,
};

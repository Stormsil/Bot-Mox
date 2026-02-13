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
const { createVmRegistryService } = require('../vm-registry/service');
const { createLicenseService } = require('../license/service');
const { createArtifactsService } = require('../artifacts/service');
const { createAgentService } = require('../agents/service');
const { createSecretsService } = require('../secrets/service');
const { createVmOpsService } = require('../vm-ops/service');
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
  admin,
  isFirebaseReady,
  proxmoxLogin,
  proxmoxRequest,
  sshExec,
  ipqsService,
  wowNamesService,
  authMiddleware: injectedAuthMiddleware,
}) {
  const router = express.Router();
  const authMiddleware = injectedAuthMiddleware || createAuthMiddleware({ admin, env, isFirebaseReady });
  const { authenticate, requireRole } = authMiddleware;
  const repos = createRepositories({ admin, env });
  const vmRegistryService = createVmRegistryService({ admin });
  const licenseService = createLicenseService({
    admin,
    env,
    vmRegistryService,
  });
  const artifactsService = createArtifactsService({
    env,
    licenseService,
  });
  const agentService = createAgentService({ env });
  const secretsService = createSecretsService({ env });
  const vmOpsService = createVmOpsService({ env, agentService });

  router.get('/health/live', (_req, res) => {
    res.json(success(buildLivenessPayload()));
  });

  router.get(
    '/health/ready',
    asyncHandler(async (_req, res) => {
      const checks = await getHealthChecks({ env, isFirebaseReady });
      const payload = buildReadinessPayload({ checks });
      const statusCode = payload.ready ? 200 : 503;
      res.status(statusCode).json(success(payload));
    })
  );

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const checks = await getHealthChecks({ env, isFirebaseReady });
      res.json(success(buildHealthPayload({ env, checks })));
    })
  );

  router.use('/auth', createAuthRoutes({ authenticate }));
  router.use(authenticate);

  router.use('/resources', createResourcesRoutes({ repositories: repos.resources }));
  router.use('/workspace', createWorkspaceRoutes({ repositories: repos.workspace }));
  router.use('/settings', createSettingsRoutes({ repo: repos.settings }));
  router.use('/bots', createBotsRoutes({ repo: repos.bots }));
  router.use('/finance', createFinanceRoutes({ repo: repos.finance }));
  router.use('/vm', createVmRoutes({ vmRegistryService }));
  router.use('/license', createLicenseRoutes({ licenseService, authMiddleware }));
  router.use('/artifacts', createArtifactsRoutes({ artifactsService, authMiddleware }));
  router.use('/agents', createAgentsRoutes({ agentService, authMiddleware }));
  router.use('/secrets', createSecretsRoutes({ secretsService, authMiddleware }));
  router.use('/vm-ops', createVmOpsRoutes({ vmOpsService, authMiddleware }));
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
    createInfraRoutes({ proxmoxLogin, proxmoxRequest, sshExec, env })
  );

  router.use((req, res) => {
    res.status(404).json(failure('NOT_FOUND', `Unknown API v1 endpoint: ${req.method} ${req.originalUrl}`));
  });

  return router;
}

module.exports = {
  createApiV1Router,
};

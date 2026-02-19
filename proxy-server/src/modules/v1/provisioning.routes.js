const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  idParamSchema,
  unattendProfileCreateSchema,
  unattendProfileUpdateSchema,
  generateIsoPayloadSchema,
  provisioningProgressPathSchema,
  provisioningValidateTokenSchema,
  provisioningReportProgressSchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { ProvisioningServiceError } = require('../provisioning/service');
const { buildUnattendXml, buildStartPs1 } = require('../unattend/xml-builder');

function withProvisioningErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof ProvisioningServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createProvisioningRoutes({ provisioningService, playbookService, s3Service, env }) {
  const router = express.Router();

  // =========================================================================
  // Unattend Profiles CRUD (user auth)
  // =========================================================================

  // GET /api/v1/unattend-profiles
  router.get(
    '/unattend-profiles',
    withProvisioningErrors(async (req, res) => {
      const auth = req.auth || {};
      const data = await provisioningService.listProfiles({
        tenantId: auth.tenant_id,
        userId: auth.uid,
      });
      return res.json(success(data));
    }),
  );

  // POST /api/v1/unattend-profiles
  router.post(
    '/unattend-profiles',
    withProvisioningErrors(async (req, res) => {
      const parsed = unattendProfileCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await provisioningService.createProfile({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        name: parsed.data.name,
        isDefault: parsed.data.is_default,
        config: parsed.data.config,
      });

      return res.status(201).json(success(data));
    }),
  );

  // PUT /api/v1/unattend-profiles/:id
  router.put(
    '/unattend-profiles/:id',
    withProvisioningErrors(async (req, res) => {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid profile ID'));
      }

      const parsed = unattendProfileUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await provisioningService.updateProfile({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        profileId: paramParsed.data.id,
        updates: parsed.data,
      });

      return res.json(success(data));
    }),
  );

  // DELETE /api/v1/unattend-profiles/:id
  router.delete(
    '/unattend-profiles/:id',
    withProvisioningErrors(async (req, res) => {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid profile ID'));
      }

      const auth = req.auth || {};
      await provisioningService.deleteProfile({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        profileId: paramParsed.data.id,
      });

      return res.json(success({ deleted: true }));
    }),
  );

  // =========================================================================
  // ISO Generation
  // =========================================================================

  // POST /api/v1/provisioning/generate-iso-payload
  router.post(
    '/provisioning/generate-iso-payload',
    withProvisioningErrors(async (req, res) => {
      const parsed = generateIsoPayloadSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      let profileConfig = parsed.data.profile_config;

      // If profile_id is provided, load from DB
      if (!profileConfig && parsed.data.profile_id) {
        const profile = await provisioningService.getProfile({
          tenantId: auth.tenant_id,
          userId: auth.uid,
          profileId: parsed.data.profile_id,
        });
        profileConfig = profile.config;
      }

      if (!profileConfig) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Either profile_id or profile_config is required'));
      }

      // Issue provisioning token
      const tokenResult = await provisioningService.issueToken({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        vmUuid: parsed.data.vm_uuid,
      });

      // Resolve API endpoint for provision.json
      const apiEndpoint =
        String(env.agentPairingPublicUrl || '').trim() || `http://127.0.0.1:${env.port || 3001}`;

      // Build XML + provision.json
      const { xml, provisionJson, computerName, username } = buildUnattendXml({
        profileConfig,
        provisionConfig: {
          vmUuid: parsed.data.vm_uuid,
          ip: parsed.data.ip,
          token: tokenResult.token,
          s3Endpoint: String(env.s3Endpoint || '').trim(),
          apiEndpoint,
        },
      });

      // Build START.ps1
      const startPs1 = buildStartPs1({
        apiEndpoint,
        vmUuid: parsed.data.vm_uuid,
      });

      // Return base64-encoded file contents for ISO creation
      const isoFiles = {
        'autounattend.xml': Buffer.from(xml, 'utf-8').toString('base64'),
        'provision.json': Buffer.from(provisionJson, 'utf-8').toString('base64'),
        'START.ps1': Buffer.from(startPs1, 'utf-8').toString('base64'),
      };

      // Include playbook if specified or user has a default
      let playbookId = null;
      if (playbookService) {
        try {
          let playbook = null;
          if (parsed.data.playbook_id) {
            playbook = await playbookService.getPlaybook({
              tenantId: auth.tenant_id,
              userId: auth.uid,
              playbookId: parsed.data.playbook_id,
            });
          } else {
            playbook = await playbookService.getDefaultPlaybook({
              tenantId: auth.tenant_id,
              userId: auth.uid,
            });
          }

          if (playbook?.content) {
            isoFiles['playbook.yml'] = Buffer.from(playbook.content, 'utf-8').toString('base64');
            playbookId = playbook.id;
          }
        } catch {
          // Playbook is optional — don't fail ISO generation
        }
      }

      // Store playbook_id on the provisioning token record
      if (playbookId && tokenResult.tokenId) {
        try {
          const { createSupabaseServiceClient } = require('../../repositories/supabase/client');
          const clientResult = createSupabaseServiceClient(env);
          if (clientResult.ok && clientResult.client) {
            await clientResult.client
              .from('provisioning_tokens')
              .update({ playbook_id: playbookId })
              .eq('id', tokenResult.tokenId);
          }
        } catch {
          // Non-critical — don't fail the request
        }
      }

      return res.json(
        success({
          files: isoFiles,
          token: tokenResult.token,
          tokenId: tokenResult.tokenId,
          expiresAt: tokenResult.expiresAt,
          computerName,
          username,
          vmUuid: parsed.data.vm_uuid,
          playbookId,
        }),
      );
    }),
  );

  // =========================================================================
  // VM-facing endpoints (provision token auth)
  // =========================================================================

  // POST /api/v1/provisioning/validate-token
  router.post(
    '/provisioning/validate-token',
    withProvisioningErrors(async (req, res) => {
      const parsed = provisioningValidateTokenSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const result = await provisioningService.validateToken(
        parsed.data.token,
        parsed.data.vm_uuid,
      );

      if (!result.valid) {
        return res.status(401).json(failure('TOKEN_INVALID', result.reason));
      }

      // Get presigned S3 URLs for bootstrap
      let bootstrapUrl = null;
      let appUrl = null;
      if (s3Service) {
        try {
          const bootstrap = await s3Service.getBootstrapUrls();
          bootstrapUrl = bootstrap.downloaderUrl;
          const app = await s3Service.getAppUrls();
          appUrl = app.setupAppUrl;
        } catch {
          // S3 optional — don't fail token validation
        }
      }

      return res.json(
        success({
          valid: true,
          userId: result.userId,
          tenantId: result.tenantId,
          bootstrap_url: bootstrapUrl,
          app_url: appUrl,
        }),
      );
    }),
  );

  // POST /api/v1/provisioning/report-progress
  router.post(
    '/provisioning/report-progress',
    withProvisioningErrors(async (req, res) => {
      const parsed = provisioningReportProgressSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      // Validate the token first
      const tokenResult = await provisioningService.validateToken(
        parsed.data.token,
        parsed.data.vm_uuid,
      );

      if (!tokenResult.valid) {
        return res.status(401).json(failure('TOKEN_INVALID', tokenResult.reason));
      }

      const data = await provisioningService.reportProgress({
        tenantId: tokenResult.tenantId,
        vmUuid: parsed.data.vm_uuid,
        tokenId: tokenResult.tokenId,
        step: parsed.data.step,
        status: parsed.data.status,
        details: parsed.data.details,
      });

      // If step=completed, mark token as used
      if (parsed.data.step === 'completed' && parsed.data.status === 'completed') {
        await provisioningService.markUsed(tokenResult.tokenId);
      }

      return res.json(success(data));
    }),
  );

  // GET /api/v1/provisioning/progress/:vmUuid
  router.get(
    '/provisioning/progress/:vmUuid',
    withProvisioningErrors(async (req, res) => {
      const parsedPath = provisioningProgressPathSchema.safeParse(req.params || {});
      if (!parsedPath.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid route parameters', parsedPath.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await provisioningService.getProgress({
        tenantId: auth.tenant_id,
        vmUuid: parsedPath.data.vmUuid,
      });

      return res.json(success(data));
    }),
  );

  return router;
}

module.exports = {
  createProvisioningRoutes,
};

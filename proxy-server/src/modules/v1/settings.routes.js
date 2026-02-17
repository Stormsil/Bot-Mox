const express = require('express');
const { env } = require('../../config/env');
const { success, failure } = require('../../contracts/envelope');
const { resolveSettingsMutationSchema } = require('../../contracts/schemas');
const { buildTenantPath } = require('../../utils/tenant-paths');
const {
  createSupabaseStoragePolicyRepository,
  SupabaseStoragePolicyRepositoryError,
} = require('../../repositories/supabase/storage-policy-repository');
const { asyncHandler } = require('./helpers');

const SETTINGS_ROOT = 'settings';
const INVALID_PATH_SEGMENT_PATTERN = /[.#$\[\]]/;

function parseSettingsPath(pathValue) {
  const rawPath = String(pathValue || '').trim();
  const normalized = rawPath.replace(/^\/+/, '').replace(/\/+$/, '');

  if (!normalized) {
    return {
      success: true,
      subPath: '',
      targetPath: SETTINGS_ROOT,
    };
  }

  const inputSegments = normalized.split('/').filter(Boolean);
  const segments = inputSegments[0] === SETTINGS_ROOT ? inputSegments.slice(1) : inputSegments;

  for (const segment of segments) {
    if (
      !segment ||
      segment === '.' ||
      segment === '..' ||
      INVALID_PATH_SEGMENT_PATTERN.test(segment)
    ) {
      return {
        success: false,
        error: `Invalid path segment: ${segment || '(empty)'}`,
      };
    }
  }

  const subPath = segments.join('/');
  return {
    success: true,
    subPath,
    targetPath: subPath ? `${SETTINGS_ROOT}/${subPath}` : SETTINGS_ROOT,
  };
}

function resolveSettingsTargetPath(parsedPath, auth) {
  if (!parsedPath?.subPath) {
    return SETTINGS_ROOT;
  }

  if (parsedPath.subPath === 'storage_policy') {
    const tenantId = String(auth?.tenant_id || 'default').trim() || 'default';
    return buildTenantPath(tenantId, 'settings', 'storage_policy');
  }

  return parsedPath.targetPath;
}

function isStoragePolicySubPath(parsedPath) {
  return parsedPath?.subPath === 'storage_policy';
}

function shouldUseSupabaseStoragePolicy(parsedPath) {
  return isStoragePolicySubPath(parsedPath);
}

function resolveTenantId(auth) {
  return String(auth?.tenant_id || 'default').trim() || 'default';
}

function writeSupabaseConfigError(res, reason) {
  return res.status(503).json(
    failure(
      'SUPABASE_CONFIG_ERROR',
      'Supabase storage policy backend is not configured',
      reason || null
    )
  );
}

function writeSupabaseStoragePolicyError(res, error) {
  if (error instanceof SupabaseStoragePolicyRepositoryError) {
    return res.status(error.status).json(failure(error.code, error.message, error.details));
  }
  return res.status(500).json(failure('INTERNAL_ERROR', 'Unexpected storage policy backend failure'));
}

function createSettingsRoutes({ repo }) {
  const router = express.Router();
  const storagePolicyRepository = createSupabaseStoragePolicyRepository({ env });

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const data = await repo.read(SETTINGS_ROOT);
      return res.json(success(data || {}));
    })
  );

  router.get(
    '/*',
    asyncHandler(async (req, res) => {
      const parsedPath = parseSettingsPath(req.params[0]);
      if (!parsedPath.success) {
        return res.status(400).json(
          failure('BAD_REQUEST', 'Invalid settings path', {
            path: req.params[0],
            reason: parsedPath.error,
          })
        );
      }

      if (shouldUseSupabaseStoragePolicy(parsedPath)) {
        if (!storagePolicyRepository.enabled) {
          return writeSupabaseConfigError(res, storagePolicyRepository.reason);
        }

        try {
          const data = await storagePolicyRepository.getByTenantId(resolveTenantId(req.auth));
          return res.json(success(data));
        } catch (error) {
          return writeSupabaseStoragePolicyError(res, error);
        }
      }

      const targetPath = resolveSettingsTargetPath(parsedPath, req.auth);
      const data = await repo.read(targetPath);
      return res.json(success(data));
    })
  );

  router.put(
    '/*',
    asyncHandler(async (req, res) => {
      const parsedPath = parseSettingsPath(req.params[0]);
      if (!parsedPath.success) {
        return res.status(400).json(
          failure('BAD_REQUEST', 'Invalid settings path', {
            path: req.params[0],
            reason: parsedPath.error,
          })
        );
      }

      const mutationSchema = resolveSettingsMutationSchema(parsedPath.subPath);
      const parsedBody = mutationSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      if (shouldUseSupabaseStoragePolicy(parsedPath)) {
        if (!storagePolicyRepository.enabled) {
          return writeSupabaseConfigError(res, storagePolicyRepository.reason);
        }

        try {
          const data = await storagePolicyRepository.upsertByTenantId(
            resolveTenantId(req.auth),
            parsedBody.data,
            req.auth?.uid
          );
          return res.json(success(data));
        } catch (error) {
          return writeSupabaseStoragePolicyError(res, error);
        }
      }

      const targetPath = resolveSettingsTargetPath(parsedPath, req.auth);
      const data = await repo.write(targetPath, parsedBody.data, { merge: true });
      return res.json(success(data));
    })
  );

  router.patch(
    '/*',
    asyncHandler(async (req, res) => {
      const parsedPath = parseSettingsPath(req.params[0]);
      if (!parsedPath.success) {
        return res.status(400).json(
          failure('BAD_REQUEST', 'Invalid settings path', {
            path: req.params[0],
            reason: parsedPath.error,
          })
        );
      }

      const mutationSchema = resolveSettingsMutationSchema(parsedPath.subPath);
      const parsedBody = mutationSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      if (shouldUseSupabaseStoragePolicy(parsedPath)) {
        if (!storagePolicyRepository.enabled) {
          return writeSupabaseConfigError(res, storagePolicyRepository.reason);
        }

        try {
          const data = await storagePolicyRepository.upsertByTenantId(
            resolveTenantId(req.auth),
            parsedBody.data,
            req.auth?.uid
          );
          return res.json(success(data));
        } catch (error) {
          return writeSupabaseStoragePolicyError(res, error);
        }
      }

      const targetPath = resolveSettingsTargetPath(parsedPath, req.auth);
      const data = await repo.write(targetPath, parsedBody.data, { merge: true });
      return res.json(success(data));
    })
  );

  router.use((_req, res) => {
    return res.status(404).json(failure('NOT_FOUND', 'Settings endpoint not found'));
  });

  return router;
}

module.exports = {
  createSettingsRoutes,
};

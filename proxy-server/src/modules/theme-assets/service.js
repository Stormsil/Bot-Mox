const { randomUUID } = require('crypto');
const { createSupabaseServiceClient } = require('../../repositories/supabase/client');
const { createS3StorageProvider, S3StorageProviderError } = require('../../repositories/s3/storage-provider');

const TABLE = 'theme_background_assets';
const STATUS_PENDING = 'pending';
const STATUS_READY = 'ready';
const STATUS_DELETED = 'deleted';

class ThemeAssetsServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ThemeAssetsServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'THEME_ASSETS_SERVICE_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function normalizeTenantId(value) {
  const normalized = String(value || '').trim() || 'default';
  return normalized.slice(0, 120);
}

function normalizeUserId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return normalized.slice(0, 200);
}

function sanitizeFileName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return compact || 'background';
}

function mapSupabaseError(error, fallbackMessage, code = 'SUPABASE_QUERY_FAILED') {
  return new ThemeAssetsServiceError(502, code, fallbackMessage, error?.message || String(error || 'unknown-error'));
}

function createThemeAssetsService({ env }) {
  const supabaseResult = createSupabaseServiceClient(env);
  if (!supabaseResult.ok || !supabaseResult.client) {
    return {
      enabled: false,
      reason: `Supabase is not configured for theme assets: ${supabaseResult.reason || 'unknown reason'}`,
      code: 'SUPABASE_CONFIG_ERROR',
    };
  }

  const storageProviderResult = createS3StorageProvider({ env });
  if (!storageProviderResult.enabled || !storageProviderResult.provider) {
    return {
      enabled: false,
      reason: `S3 storage is not configured for theme assets: ${storageProviderResult.reason || 'unknown reason'}`,
      code: storageProviderResult.code || 'S3_CONFIG_ERROR',
    };
  }

  const supabase = supabaseResult.client;
  const storageProvider = storageProviderResult.provider;
  const bucket = String(env?.s3BucketThemeAssets || env?.s3BucketArtifacts || '').trim();

  if (!bucket) {
    return {
      enabled: false,
      reason: 'S3_BUCKET_THEME_ASSETS or S3_BUCKET_ARTIFACTS is required for theme assets',
      code: 'S3_CONFIG_INCOMPLETE',
    };
  }

  async function createPresignedUpload({ tenantId, actorId, filename, mimeType, sizeBytes }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedActorId = normalizeUserId(actorId);
    const assetId = randomUUID();
    const safeFileName = sanitizeFileName(filename);
    const objectKey = `theme-assets/${normalizedTenantId}/${assetId}-${safeFileName}`;

    try {
      const presigned = await storageProvider.createPresignedUploadUrl({
        objectKey,
        contentType: mimeType,
        bucket,
      });

      const row = {
        id: assetId,
        tenant_id: normalizedTenantId,
        created_by: normalizedActorId,
        object_key: objectKey,
        mime_type: mimeType,
        size_bytes: Number(sizeBytes),
        status: STATUS_PENDING,
      };

      const { error } = await supabase.from(TABLE).insert(row);
      if (error) {
        throw mapSupabaseError(error, 'Failed to create pending theme asset record', 'THEME_ASSET_CREATE_FAILED');
      }

      return {
        asset_id: assetId,
        object_key: objectKey,
        upload_url: presigned.url,
        expires_at_ms: presigned.expiresAtMs,
        expires_in_seconds: presigned.expiresInSeconds,
      };
    } catch (error) {
      if (error instanceof ThemeAssetsServiceError) {
        throw error;
      }
      if (error instanceof S3StorageProviderError) {
        throw new ThemeAssetsServiceError(error.status, error.code, error.message, error.details);
      }
      throw new ThemeAssetsServiceError(
        500,
        'THEME_ASSET_PRESIGN_FAILED',
        'Failed to prepare theme asset upload',
        error instanceof Error ? error.message : String(error || 'unknown-error')
      );
    }
  }

  async function completeUpload({ tenantId, assetId, width, height }) {
    const normalizedTenantId = normalizeTenantId(tenantId);

    const { data: asset, error: readError } = await supabase
      .from(TABLE)
      .select('id, tenant_id, object_key, mime_type, size_bytes, status')
      .eq('tenant_id', normalizedTenantId)
      .eq('id', assetId)
      .maybeSingle();

    if (readError) {
      throw mapSupabaseError(readError, 'Failed to read theme asset');
    }

    if (!asset) {
      throw new ThemeAssetsServiceError(404, 'NOT_FOUND', 'Theme asset not found');
    }

    if (asset.status === STATUS_DELETED) {
      throw new ThemeAssetsServiceError(409, 'ASSET_DELETED', 'Theme asset is already deleted');
    }

    let metadata;
    try {
      metadata = await storageProvider.headObject({
        objectKey: asset.object_key,
        bucket,
      });
    } catch (error) {
      if (error instanceof S3StorageProviderError) {
        throw new ThemeAssetsServiceError(error.status, error.code, error.message, error.details);
      }
      throw error;
    }

    if (!metadata.exists) {
      throw new ThemeAssetsServiceError(409, 'ASSET_NOT_UPLOADED', 'Theme asset object was not uploaded');
    }

    const payload = {
      status: STATUS_READY,
      width: Number.isFinite(width) ? Number(width) : null,
      height: Number.isFinite(height) ? Number(height) : null,
      updated_at: new Date().toISOString(),
      size_bytes: metadata.contentLength > 0 ? metadata.contentLength : asset.size_bytes,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('tenant_id', normalizedTenantId)
      .eq('id', asset.id)
      .select('id, object_key, mime_type, size_bytes, width, height, status, created_at, updated_at')
      .single();

    if (error) {
      throw mapSupabaseError(error, 'Failed to mark theme asset as ready', 'THEME_ASSET_COMPLETE_FAILED');
    }

    const download = await storageProvider.createPresignedDownloadUrl({
      objectKey: data.object_key,
      bucket,
      expiresInSeconds: 300,
    });

    return {
      id: data.id,
      object_key: data.object_key,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      width: data.width,
      height: data.height,
      status: data.status,
      image_url: download.url,
      image_url_expires_at_ms: download.expiresAtMs,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async function listAssets({ tenantId }) {
    const normalizedTenantId = normalizeTenantId(tenantId);

    const { data, error } = await supabase
      .from(TABLE)
      .select('id, object_key, mime_type, size_bytes, width, height, status, created_at, updated_at')
      .eq('tenant_id', normalizedTenantId)
      .in('status', [STATUS_PENDING, STATUS_READY])
      .order('created_at', { ascending: false });

    if (error) {
      throw mapSupabaseError(error, 'Failed to list theme assets');
    }

    const rows = Array.isArray(data) ? data : [];
    const nowMs = Date.now();

    const items = await Promise.all(rows.map(async (item) => {
      if (item.status !== STATUS_READY) {
        return {
          id: item.id,
          object_key: item.object_key,
          mime_type: item.mime_type,
          size_bytes: item.size_bytes,
          width: item.width,
          height: item.height,
          status: item.status,
          image_url: null,
          image_url_expires_at_ms: null,
          created_at: item.created_at,
          updated_at: item.updated_at,
        };
      }

      const signed = await storageProvider.createPresignedDownloadUrl({
        objectKey: item.object_key,
        bucket,
        expiresInSeconds: 300,
      });

      return {
        id: item.id,
        object_key: item.object_key,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        width: item.width,
        height: item.height,
        status: item.status,
        image_url: signed.url,
        image_url_expires_at_ms: signed.expiresAtMs,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    }));

    return {
      generated_at_ms: nowMs,
      items,
    };
  }

  async function deleteAsset({ tenantId, assetId }) {
    const normalizedTenantId = normalizeTenantId(tenantId);

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: STATUS_DELETED,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', normalizedTenantId)
      .eq('id', assetId)
      .in('status', [STATUS_PENDING, STATUS_READY])
      .select('id')
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error, 'Failed to delete theme asset', 'THEME_ASSET_DELETE_FAILED');
    }

    if (!data) {
      throw new ThemeAssetsServiceError(404, 'NOT_FOUND', 'Theme asset not found');
    }

    return {
      id: data.id,
      status: STATUS_DELETED,
    };
  }

  return {
    enabled: true,
    createPresignedUpload,
    completeUpload,
    listAssets,
    deleteAsset,
  };
}

module.exports = {
  ThemeAssetsServiceError,
  createThemeAssetsService,
};

const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_PRESIGN_TTL_SECONDS = 300;
const MIN_PRESIGN_TTL_SECONDS = 60;
const MAX_PRESIGN_TTL_SECONDS = 300;

class S3StorageProviderError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'S3StorageProviderError';
    this.status = Number(status || 500);
    this.code = String(code || 'S3_STORAGE_PROVIDER_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeObjectKey(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^\/+/, '');
  if (!normalized) {
    throw new S3StorageProviderError(400, 'BAD_REQUEST', 'object_key is required');
  }
  if (normalized.includes('..') || normalized.includes('//')) {
    throw new S3StorageProviderError(
      400,
      'BAD_REQUEST',
      'object_key contains invalid path traversal',
    );
  }
  return normalized;
}

function parseS3Config(inputEnv) {
  const endpoint = String(inputEnv?.s3Endpoint || inputEnv?.S3_ENDPOINT || '').trim();
  const bucket = String(inputEnv?.s3BucketArtifacts || inputEnv?.S3_BUCKET_ARTIFACTS || '').trim();
  const accessKeyId = String(inputEnv?.s3AccessKeyId || inputEnv?.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(
    inputEnv?.s3SecretAccessKey || inputEnv?.S3_SECRET_ACCESS_KEY || '',
  ).trim();
  const region =
    String(inputEnv?.s3Region || inputEnv?.S3_REGION || DEFAULT_REGION).trim() || DEFAULT_REGION;
  const forcePathStyle = toBoolean(
    inputEnv?.s3ForcePathStyle ?? inputEnv?.S3_FORCE_PATH_STYLE,
    true,
  );
  const defaultPresignTtlSeconds = clamp(
    toInt(
      inputEnv?.s3PresignTtlSeconds ?? inputEnv?.S3_PRESIGN_TTL_SECONDS,
      DEFAULT_PRESIGN_TTL_SECONDS,
    ),
    MIN_PRESIGN_TTL_SECONDS,
    MAX_PRESIGN_TTL_SECONDS,
  );

  const anyConfigured = Boolean(endpoint || bucket || accessKeyId || secretAccessKey);
  if (!anyConfigured) {
    return {
      ok: false,
      code: 'S3_NOT_CONFIGURED',
      reason: 'S3 endpoint, bucket and credentials are not configured',
    };
  }

  const missing = [];
  if (!endpoint) missing.push('S3_ENDPOINT');
  if (!bucket) missing.push('S3_BUCKET_ARTIFACTS');
  if (!accessKeyId) missing.push('S3_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');

  if (missing.length > 0) {
    return {
      ok: false,
      code: 'S3_CONFIG_INCOMPLETE',
      reason: `Incomplete S3 config: missing ${missing.join(', ')}`,
    };
  }

  try {
    new URL(endpoint);
  } catch {
    return {
      ok: false,
      code: 'S3_CONFIG_INVALID',
      reason: 'S3_ENDPOINT must be a valid absolute URL',
    };
  }

  return {
    ok: true,
    config: {
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region,
      forcePathStyle,
      defaultPresignTtlSeconds,
    },
  };
}

class S3StorageProvider {
  constructor(config) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  normalizeTtl(expiresInSeconds) {
    const requested = toInt(expiresInSeconds, this.config.defaultPresignTtlSeconds);
    return clamp(requested, MIN_PRESIGN_TTL_SECONDS, MAX_PRESIGN_TTL_SECONDS);
  }

  resolveBucket(bucketName) {
    const normalized = String(bucketName || '').trim();
    return normalized || this.config.bucket;
  }

  extractErrorReason(error) {
    if (!error) return 'unknown-s3-error';
    if (typeof error === 'string') return error;
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && typeof error.Code === 'string') return error.Code;
    return 'unknown-s3-error';
  }

  async probeReadiness() {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.config.bucket,
        }),
      );
      return {
        ready: true,
      };
    } catch (error) {
      return {
        ready: false,
        reason: this.extractErrorReason(error),
      };
    }
  }

  async headObject({ objectKey, bucket }) {
    const key = normalizeObjectKey(objectKey);
    const targetBucket = this.resolveBucket(bucket);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: targetBucket,
          Key: key,
        }),
      );

      return {
        exists: true,
        objectKey: key,
        contentLength: Number(response?.ContentLength || 0),
        eTag: typeof response?.ETag === 'string' ? response.ETag : null,
        lastModified: response?.LastModified ? new Date(response.LastModified).toISOString() : null,
        metadata: response?.Metadata || {},
      };
    } catch (error) {
      const statusCode = Number(error?.$metadata?.httpStatusCode || 0);
      if (statusCode === 404 || error?.name === 'NotFound') {
        return {
          exists: false,
          objectKey: key,
        };
      }

      throw new S3StorageProviderError(
        502,
        'S3_HEAD_OBJECT_FAILED',
        'Failed to read object metadata from S3 storage',
        this.extractErrorReason(error),
      );
    }
  }

  async createPresignedDownloadUrl({ objectKey, expiresInSeconds, bucket }) {
    const key = normalizeObjectKey(objectKey);
    const ttlSeconds = this.normalizeTtl(expiresInSeconds);
    const targetBucket = this.resolveBucket(bucket);

    try {
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });
      const url = await getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
      const nowMs = Date.now();
      const expiresAtMs = nowMs + ttlSeconds * 1000;

      return {
        url,
        objectKey: key,
        expiresInSeconds: ttlSeconds,
        expiresAtMs,
      };
    } catch (error) {
      throw new S3StorageProviderError(
        502,
        'S3_PRESIGN_FAILED',
        'Failed to generate presigned S3 download URL',
        this.extractErrorReason(error),
      );
    }
  }

  async createPresignedUploadUrl({ objectKey, contentType, expiresInSeconds, bucket }) {
    const key = normalizeObjectKey(objectKey);
    const ttlSeconds = this.normalizeTtl(expiresInSeconds);
    const targetBucket = this.resolveBucket(bucket);
    const normalizedContentType = String(contentType || '').trim();

    try {
      const command = new PutObjectCommand({
        Bucket: targetBucket,
        Key: key,
        ...(normalizedContentType ? { ContentType: normalizedContentType } : {}),
      });

      const url = await getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
      const nowMs = Date.now();
      const expiresAtMs = nowMs + ttlSeconds * 1000;

      return {
        url,
        objectKey: key,
        bucket: targetBucket,
        contentType: normalizedContentType || null,
        expiresInSeconds: ttlSeconds,
        expiresAtMs,
      };
    } catch (error) {
      throw new S3StorageProviderError(
        502,
        'S3_PRESIGN_FAILED',
        'Failed to generate presigned S3 upload URL',
        this.extractErrorReason(error),
      );
    }
  }
}

function createS3StorageProvider({ env }) {
  const parsed = parseS3Config(env);
  if (!parsed.ok || !parsed.config) {
    return {
      enabled: false,
      code: parsed.code || 'S3_CONFIG_ERROR',
      reason: parsed.reason || 'S3 config is invalid',
      provider: null,
    };
  }

  return {
    enabled: true,
    code: 'OK',
    reason: null,
    provider: new S3StorageProvider(parsed.config),
  };
}

module.exports = {
  S3StorageProvider,
  S3StorageProviderError,
  createS3StorageProvider,
  parseS3Config,
};

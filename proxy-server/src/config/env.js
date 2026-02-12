const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];
const DEV_DEFAULT_INTERNAL_API_TOKEN = 'change-me-api-token';
const DEV_DEFAULT_INTERNAL_INFRA_TOKEN = 'change-me-infra-token';

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoundedInt(value, fallback, min, max) {
  const parsed = toInt(value, fallback);
  return Math.max(min, Math.min(max, parsed));
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function parseCsv(value, fallback = []) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return fallback;
  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDataBackend(value, fallback = 'rtdb') {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'supabase') return 'supabase';
  if (normalized === 'rtdb') return 'rtdb';
  return fallback;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3001),
  corsOrigins: parseCsv(process.env.CORS_ORIGIN, DEFAULT_CORS_ORIGINS),
  allowInsecureDevTokens: parseBoolean(process.env.ALLOW_INSECURE_DEV_TOKENS, false),
  internalApiToken: String(
    process.env.INTERNAL_API_TOKEN ||
      (((process.env.NODE_ENV || 'development') === 'development' && parseBoolean(process.env.ALLOW_INSECURE_DEV_TOKENS, false))
        ? DEV_DEFAULT_INTERNAL_API_TOKEN
        : '')
  ).trim(),
  internalInfraToken: String(
    process.env.INTERNAL_INFRA_TOKEN ||
      (((process.env.NODE_ENV || 'development') === 'development' && parseBoolean(process.env.ALLOW_INSECURE_DEV_TOKENS, false))
        ? DEV_DEFAULT_INTERNAL_INFRA_TOKEN
        : '')
  ).trim(),
  apiRateLimitWindowMs: toInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  apiRateLimitMax: toInt(process.env.API_RATE_LIMIT_MAX, 500),
  sshExecAllowUnsafe: parseBoolean(process.env.SSH_EXEC_ALLOW_UNSAFE, false),
  defaultTenantId: String(process.env.DEFAULT_TENANT_ID || 'default').trim() || 'default',
  licenseLeaseSecret: String(process.env.LICENSE_LEASE_SECRET || '').trim(),
  licenseLeaseTtlSeconds: toInt(process.env.LICENSE_LEASE_TTL_SECONDS, 300),
  dataBackend: parseDataBackend(process.env.DATA_BACKEND, 'rtdb'),
  supabaseUrl: String(process.env.SUPABASE_URL || '').trim(),
  supabaseServiceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  supabaseAdminEmails: parseCsv(process.env.SUPABASE_ADMIN_EMAILS, []),
  supabaseAdminUserIds: parseCsv(process.env.SUPABASE_ADMIN_USER_IDS, []),
  s3Endpoint: String(process.env.S3_ENDPOINT || '').trim(),
  s3Region: String(process.env.S3_REGION || 'us-east-1').trim() || 'us-east-1',
  s3BucketArtifacts: String(process.env.S3_BUCKET_ARTIFACTS || '').trim(),
  s3AccessKeyId: String(process.env.S3_ACCESS_KEY_ID || '').trim(),
  s3SecretAccessKey: String(process.env.S3_SECRET_ACCESS_KEY || '').trim(),
  s3ForcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, true),
  s3PresignTtlSeconds: toBoundedInt(process.env.S3_PRESIGN_TTL_SECONDS, 300, 60, 300),
  requireS3Ready: parseBoolean(process.env.REQUIRE_S3_READY, false),
  requireSupabaseReady: parseBoolean(process.env.REQUIRE_SUPABASE_READY, false),
  requireFirebaseReady: parseBoolean(process.env.REQUIRE_FIREBASE_READY, false),
  readinessProbeTimeoutMs: toInt(process.env.READINESS_PROBE_TIMEOUT_MS, 2000),
};

module.exports = {
  env,
};

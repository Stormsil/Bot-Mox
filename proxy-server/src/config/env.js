const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

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

function parseDataBackend(value, fallback = 'supabase') {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'supabase') return 'supabase';
  return 'supabase';
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3001),
  corsOrigins: parseCsv(process.env.CORS_ORIGIN, DEFAULT_CORS_ORIGINS),
  stranglerNestUrl: String(process.env.STRANGLER_NEST_URL || '')
    .trim()
    .replace(/\/+$/, ''),
  stranglerModules: parseCsv(process.env.STRANGLER_MODULES, []),
  stranglerFallbackToLegacy: parseBoolean(process.env.STRANGLER_FALLBACK_TO_LEGACY, true),
  stranglerTimeoutMs: toBoundedInt(process.env.STRANGLER_TIMEOUT_MS, 20_000, 1000, 120_000),
  apiRateLimitWindowMs: toInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  apiRateLimitMax: toInt(process.env.API_RATE_LIMIT_MAX, 10_000),
  sshExecAllowUnsafe: parseBoolean(process.env.SSH_EXEC_ALLOW_UNSAFE, false),
  defaultTenantId: String(process.env.DEFAULT_TENANT_ID || 'default').trim() || 'default',
  licenseLeaseSecret: String(process.env.LICENSE_LEASE_SECRET || '').trim(),
  licenseLeaseTtlSeconds: toInt(process.env.LICENSE_LEASE_TTL_SECONDS, 300),
  agentAuthSecret: String(
    process.env.AGENT_AUTH_SECRET || process.env.LICENSE_LEASE_SECRET || '',
  ).trim(),
  agentTokenTtlSeconds: toBoundedInt(
    process.env.AGENT_TOKEN_TTL_SECONDS,
    60 * 60 * 24 * 30,
    300,
    60 * 60 * 24 * 180,
  ),
  agentPairingPublicUrl: String(process.env.AGENT_PAIRING_PUBLIC_URL || '')
    .trim()
    .replace(/\/+$/, ''),
  dataBackend: parseDataBackend(process.env.DATA_BACKEND, 'supabase'),
  supabaseUrl: String(process.env.SUPABASE_URL || '').trim(),
  supabaseAnonKey: String(process.env.SUPABASE_ANON_KEY || '').trim(),
  supabaseServiceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  supabaseAdminEmails: parseCsv(process.env.SUPABASE_ADMIN_EMAILS, []),
  supabaseAdminUserIds: parseCsv(process.env.SUPABASE_ADMIN_USER_IDS, []),
  s3Endpoint: String(process.env.S3_ENDPOINT || '').trim(),
  s3Region: String(process.env.S3_REGION || 'us-east-1').trim() || 'us-east-1',
  s3BucketArtifacts: String(
    process.env.S3_BUCKET_ARTIFACTS || process.env.S3_BUCKET_THEME_ASSETS || '',
  ).trim(),
  s3BucketThemeAssets: String(
    process.env.S3_BUCKET_THEME_ASSETS || process.env.S3_BUCKET_ARTIFACTS || '',
  ).trim(),
  s3AccessKeyId: String(process.env.S3_ACCESS_KEY_ID || '').trim(),
  s3SecretAccessKey: String(process.env.S3_SECRET_ACCESS_KEY || '').trim(),
  s3ForcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, true),
  s3PresignTtlSeconds: toBoundedInt(process.env.S3_PRESIGN_TTL_SECONDS, 300, 60, 300),
  requireS3Ready: parseBoolean(process.env.REQUIRE_S3_READY, false),
  requireSupabaseReady: parseBoolean(process.env.REQUIRE_SUPABASE_READY, false),
  readinessProbeTimeoutMs: toInt(process.env.READINESS_PROBE_TIMEOUT_MS, 2000),
  s3BucketProvisioning: String(process.env.S3_BUCKET_PROVISIONING || '').trim(),
  provisionTokenSecret: String(process.env.PROVISION_TOKEN_SECRET || '').trim(),
  provisionTokenTtlDays: toInt(process.env.PROVISION_TOKEN_TTL_DAYS, 30),
};

module.exports = {
  env,
};

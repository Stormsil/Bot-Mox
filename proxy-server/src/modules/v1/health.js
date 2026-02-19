const { createSupabaseServiceClient } = require('../../repositories/supabase/client');
const { createS3StorageProvider } = require('../../repositories/s3/storage-provider');

function isSupabaseRequired(env) {
  return (
    String(env?.dataBackend || '').toLowerCase() === 'supabase' ||
    Boolean(env?.requireSupabaseReady)
  );
}

function isS3Required(env) {
  return Boolean(env?.requireS3Ready);
}

async function probeSupabase(env) {
  const required = isSupabaseRequired(env);
  if (!required && (!env?.supabaseUrl || !env?.supabaseServiceRoleKey)) {
    return {
      required,
      ready: true,
      reason: 'not-configured',
    };
  }

  const clientResult = createSupabaseServiceClient(env);
  if (!clientResult.ok || !clientResult.client) {
    return {
      required,
      ready: false,
      reason: clientResult.reason || 'supabase-client-config-error',
    };
  }

  try {
    const { error } = await clientResult.client
      .from('storage_policies')
      .select('tenant_id')
      .limit(1);

    if (error) {
      return {
        required,
        ready: false,
        reason: error.message || 'supabase-query-failed',
      };
    }

    return {
      required,
      ready: true,
    };
  } catch (error) {
    return {
      required,
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeS3(env) {
  const required = isS3Required(env);
  const providerResult = createS3StorageProvider({ env });
  if (!providerResult.enabled || !providerResult.provider) {
    return {
      required,
      ready: !required && providerResult.code === 'S3_NOT_CONFIGURED',
      reason: providerResult.reason || 's3-provider-config-error',
      code: providerResult.code,
    };
  }

  const readiness = await providerResult.provider.probeReadiness();
  if (readiness.ready) {
    return {
      required,
      ready: true,
      code: 'OK',
    };
  }

  return {
    required,
    ready: false,
    reason: readiness.reason || 's3-readiness-check-failed',
    code: 'S3_NOT_READY',
  };
}

async function getHealthChecks({ env }) {
  const [supabase, s3] = await Promise.all([probeSupabase(env), probeS3(env)]);

  return {
    supabase,
    s3,
  };
}

function buildHealthPayload({ env, checks }) {
  return {
    service: 'bot-mox-api-v1',
    timestamp: new Date().toISOString(),
    data_backend: env.dataBackend,
    supabase_ready: checks.supabase.ready,
    s3_ready: checks.s3.ready,
    supabase_configured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
    s3_configured: Boolean(env.s3Endpoint && env.s3BucketArtifacts),
  };
}

function buildLivenessPayload() {
  return {
    service: 'bot-mox-api-v1',
    timestamp: new Date().toISOString(),
    status: 'live',
  };
}

function buildReadinessPayload({ checks }) {
  const ready =
    (!checks.supabase.required || checks.supabase.ready) &&
    (!checks.s3.required || checks.s3.ready);
  return {
    status: ready ? 'ready' : 'not-ready',
    ready,
    checks,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getHealthChecks,
  buildHealthPayload,
  buildLivenessPayload,
  buildReadinessPayload,
};

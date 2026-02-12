const axios = require('axios');
const { createSupabaseServiceClient } = require('../../repositories/supabase/client');

function buildMinioProbeUrl(endpoint) {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    parsed.pathname = '/minio/health/ready';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function isSupabaseRequired(env) {
  return String(env?.dataBackend || '').toLowerCase() === 'supabase' || Boolean(env?.requireSupabaseReady);
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
  const endpoint = String(env?.s3Endpoint || '').trim();
  if (!endpoint) {
    return {
      required,
      ready: !required,
      reason: 'not-configured',
    };
  }

  const probeUrl = buildMinioProbeUrl(endpoint);
  if (!probeUrl) {
    return {
      required,
      ready: false,
      reason: 'invalid-s3-endpoint-url',
    };
  }

  try {
    const response = await axios.get(probeUrl, {
      timeout: Math.max(500, Number(env?.readinessProbeTimeoutMs || 2000)),
      validateStatus: (status) => status >= 200 && status < 500,
    });
    return {
      required,
      ready: response.status >= 200 && response.status < 400,
      status: response.status,
    };
  } catch (error) {
    return {
      required,
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getHealthChecks({ env, isFirebaseReady }) {
  const [supabase, s3] = await Promise.all([probeSupabase(env), probeS3(env)]);
  const firebaseReady = Boolean(isFirebaseReady());

  return {
    firebase: {
      required: true,
      ready: firebaseReady,
    },
    supabase,
    s3,
  };
}

function buildHealthPayload({ env, checks }) {
  return {
    service: 'bot-mox-api-v1',
    timestamp: new Date().toISOString(),
    firebase: checks.firebase.ready,
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
  const ready = checks.firebase.ready && checks.supabase.ready && checks.s3.ready;
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

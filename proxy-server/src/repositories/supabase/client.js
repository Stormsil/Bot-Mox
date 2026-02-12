let cachedClient = null;
let cachedSignature = '';

function createSignature(url, key) {
  return `${String(url || '').trim()}::${String(key || '').trim()}`;
}

function createSupabaseServiceClient(env) {
  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = String(env?.supabaseUrl || '').trim();
  const supabaseServiceRoleKey = String(env?.supabaseServiceRoleKey || '').trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return {
      ok: false,
      reason: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      client: null,
    };
  }

  const signature = createSignature(supabaseUrl, supabaseServiceRoleKey);
  if (cachedClient && cachedSignature === signature) {
    return {
      ok: true,
      client: cachedClient,
    };
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  cachedSignature = signature;

  return {
    ok: true,
    client: cachedClient,
  };
}

module.exports = {
  createSupabaseServiceClient,
};


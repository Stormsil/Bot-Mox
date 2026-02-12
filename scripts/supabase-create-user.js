#!/usr/bin/env node
/* eslint-disable no-console */

function readArg(name) {
  const argv = process.argv.slice(2);
  const prefix = `--${name}=`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }

  const index = argv.indexOf(`--${name}`);
  if (index !== -1 && argv[index + 1]) return argv[index + 1];
  return '';
}

function required(name, value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw new Error(`Missing required ${name}.`);
  }
  return trimmed;
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

async function main() {
  const supabasePublicUrl = required(
    'env SUPABASE_PUBLIC_URL',
    process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL
  );
  const serviceRoleKey = required('env SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

  const email = required('arg --email', readArg('email'));
  const password = required('arg --password', readArg('password'));
  const tenantId = String(readArg('tenant') || process.env.DEFAULT_TENANT_ID || 'default').trim() || 'default';

  const url = `${trimTrailingSlash(supabasePublicUrl)}/auth/v1/admin/users`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        tenant_id: tenantId,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.msg || payload?.error_description || payload?.error || response.statusText;
    throw new Error(`Supabase user create failed (${response.status}): ${message}`);
  }

  const user = payload?.user || payload;
  console.log('[supabase-create-user] OK');
  console.log(`id=${user?.id || ''}`);
  console.log(`email=${user?.email || ''}`);
}

main().catch((error) => {
  console.error('[supabase-create-user] ERROR');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});


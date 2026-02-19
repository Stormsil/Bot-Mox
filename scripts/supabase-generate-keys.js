#!/usr/bin/env node
/* eslint-disable no-console */

const crypto = require('node:crypto');

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
  if (!trimmed) throw new Error(`Missing required ${name}.`);
  return trimmed;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function encodeJson(value) {
  return base64url(Buffer.from(JSON.stringify(value), 'utf8'));
}

function signHs256(secret, data) {
  return base64url(crypto.createHmac('sha256', secret).update(data).digest());
}

function jwtHs256(secret, payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encoded = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = signHs256(secret, encoded);
  return `${encoded}.${signature}`;
}

async function main() {
  const secret = required(
    'arg --jwt-secret',
    readArg('jwt-secret') || process.env.SUPABASE_JWT_SECRET,
  );
  const issuer = String(readArg('issuer') || 'supabase').trim() || 'supabase';
  const ttlDays = Math.max(1, toInt(readArg('days') || '3650', 3650));
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;

  const anon = jwtHs256(secret, { iss: issuer, role: 'anon', exp });
  const serviceRole = jwtHs256(secret, { iss: issuer, role: 'service_role', exp });

  console.log('# Supabase keys (generated)');
  console.log(`SUPABASE_JWT_SECRET=${secret}`);
  console.log(`SUPABASE_ANON_KEY=${anon}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRole}`);
}

main().catch((error) => {
  console.error('[supabase-generate-keys] ERROR');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

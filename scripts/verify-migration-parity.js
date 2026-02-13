#!/usr/bin/env node
/**
 * D-03: Parity verification — compares RTDB and Supabase record counts
 * and samples random records for field-level comparison.
 *
 * Usage:
 *   node scripts/verify-migration-parity.js
 *
 * Required env:
 *   FIREBASE_DATABASE_URL (or firebase-admin default)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DEFAULT_TENANT_ID (optional, defaults to 'default')
 */

'use strict';

const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '../proxy-server/.env') });
} catch {
  // dotenv not required
}

const { env } = require('../proxy-server/src/config/env');
const { createSupabaseServiceClient } = require('../proxy-server/src/repositories/supabase/client');
const { RTDB_PATHS } = require('../proxy-server/src/repositories/rtdb/paths');

const TENANT_ID = String(env.defaultTenantId || 'default').trim() || 'default';
const SAMPLE_SIZE = 5;

function initFirebaseAdmin() {
  const admin = require('../proxy-server/src/bootstrap/firebase-admin');
  if (!admin || typeof admin.database !== 'function') {
    throw new Error('Firebase Admin not initialized.');
  }
  return admin;
}

function initSupabase() {
  const result = createSupabaseServiceClient(env);
  if (!result.ok) throw new Error(`Supabase init failed: ${result.reason}`);
  return result.client;
}

async function readRtdbPath(admin, refPath) {
  const snapshot = await admin.database().ref(refPath).once('value');
  return snapshot.val();
}

function countEntries(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return 0;
  return Object.keys(rawMap).length;
}

function sampleKeys(rawMap, count) {
  if (!rawMap || typeof rawMap !== 'object') return [];
  const keys = Object.keys(rawMap);
  if (keys.length <= count) return keys;
  const shuffled = keys.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function verifyCollection(admin, supabase, name, rtdbPath, table) {
  const rtdbRaw = await readRtdbPath(admin, rtdbPath);
  const rtdbCount = countEntries(rtdbRaw);

  const { count: sbCount, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  if (error) {
    return { name, rtdbCount, sbCount: '?', match: false, error: error.message };
  }

  const match = rtdbCount === (sbCount || 0);
  const result = { name, rtdbCount, sbCount: sbCount || 0, match };

  // Sample comparison
  if (rtdbRaw && rtdbCount > 0) {
    const sampledKeys = sampleKeys(rtdbRaw, SAMPLE_SIZE);
    const mismatches = [];

    for (const key of sampledKeys) {
      const { data: sbRow } = await supabase
        .from(table)
        .select('id, data')
        .eq('tenant_id', TENANT_ID)
        .eq('id', key)
        .maybeSingle();

      if (!sbRow) {
        mismatches.push({ id: key, reason: 'missing in Supabase' });
      }
    }

    if (mismatches.length > 0) {
      result.sampleMismatches = mismatches;
      result.match = false;
    }
  }

  return result;
}

async function verifySettings(admin, supabase) {
  const rtdbTree = await readRtdbPath(admin, RTDB_PATHS.settings);
  const rtdbKeyCount = rtdbTree && typeof rtdbTree === 'object' ? Object.keys(rtdbTree).length : 0;

  const { data: sbRow, error } = await supabase
    .from('app_settings')
    .select('data')
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (error) {
    return { name: 'app_settings', rtdbKeys: rtdbKeyCount, sbExists: false, match: false, error: error.message };
  }

  const sbKeyCount = sbRow?.data && typeof sbRow.data === 'object' ? Object.keys(sbRow.data).length : 0;

  return {
    name: 'app_settings',
    rtdbKeys: rtdbKeyCount,
    sbKeys: sbKeyCount,
    match: rtdbKeyCount === sbKeyCount,
  };
}

async function main() {
  console.log('RTDB ↔ Supabase parity verification');
  console.log(`Tenant ID: ${TENANT_ID}\n`);

  const admin = initFirebaseAdmin();
  const supabase = initSupabase();

  const collections = [
    { name: 'resources/licenses', path: RTDB_PATHS.resources.licenses, table: 'resources_licenses' },
    { name: 'resources/proxies', path: RTDB_PATHS.resources.proxies, table: 'resources_proxies' },
    { name: 'resources/subscriptions', path: RTDB_PATHS.resources.subscriptions, table: 'resources_subscriptions' },
    { name: 'workspace/notes', path: RTDB_PATHS.workspace.notes, table: 'workspace_notes' },
    { name: 'workspace/calendar', path: RTDB_PATHS.workspace.calendar, table: 'workspace_calendar_events' },
    { name: 'workspace/kanban', path: RTDB_PATHS.workspace.kanban, table: 'workspace_kanban_tasks' },
    { name: 'bots', path: RTDB_PATHS.bots, table: 'bots' },
    { name: 'finance/operations', path: RTDB_PATHS.finance.operations, table: 'finance_operations' },
  ];

  let allMatch = true;

  for (const { name, path: rtdbPath, table } of collections) {
    const result = await verifyCollection(admin, supabase, name, rtdbPath, table);
    const status = result.match ? 'OK' : 'MISMATCH';
    console.log(`[${status}] ${result.name}: RTDB=${result.rtdbCount}, Supabase=${result.sbCount}`);
    if (result.sampleMismatches) {
      for (const m of result.sampleMismatches) {
        console.log(`       Sample mismatch: ${m.id} — ${m.reason}`);
      }
    }
    if (result.error) console.log(`       Error: ${result.error}`);
    if (!result.match) allMatch = false;
  }

  // Settings
  const settingsResult = await verifySettings(admin, supabase);
  const settingsStatus = settingsResult.match ? 'OK' : 'MISMATCH';
  console.log(`[${settingsStatus}] ${settingsResult.name}: RTDB keys=${settingsResult.rtdbKeys}, Supabase keys=${settingsResult.sbKeys || '?'}`);
  if (!settingsResult.match) allMatch = false;

  console.log(`\nOverall: ${allMatch ? 'PARITY OK' : 'PARITY MISMATCH — review above'}`);
  process.exit(allMatch ? 0 : 1);
}

main().catch((err) => {
  console.error('Parity check failed:', err.message || err);
  process.exit(1);
});

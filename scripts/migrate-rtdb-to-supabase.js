#!/usr/bin/env node
/**
 * D-03: Idempotent RTDB → Supabase migration script.
 *
 * Reads all domain data from Firebase RTDB and upserts into Supabase tables.
 * Safe to run multiple times — uses upsert (ON CONFLICT DO UPDATE).
 *
 * Usage:
 *   node scripts/migrate-rtdb-to-supabase.js [--dry-run]
 *
 * Required env:
 *   FIREBASE_DATABASE_URL (or firebase-admin default)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DEFAULT_TENANT_ID (optional, defaults to 'default')
 */

'use strict';

const path = require('path');

// Load .env from proxy-server if present
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../proxy-server/.env') });
} catch {
  // dotenv not required
}

const { env } = require('../proxy-server/src/config/env');
const { createSupabaseServiceClient } = require('../proxy-server/src/repositories/supabase/client');
const { RTDB_PATHS } = require('../proxy-server/src/repositories/rtdb/paths');

const DRY_RUN = process.argv.includes('--dry-run');
const TENANT_ID = String(env.defaultTenantId || 'default').trim() || 'default';

// ---------------------------------------------------------------------------
// Firebase Admin init
// ---------------------------------------------------------------------------

function initFirebaseAdmin() {
  const admin = require('../proxy-server/src/bootstrap/firebase-admin');
  if (!admin || typeof admin.database !== 'function') {
    throw new Error('Firebase Admin not initialized. Check FIREBASE_DATABASE_URL or service account.');
  }
  return admin;
}

async function readRtdbPath(admin, refPath) {
  const snapshot = await admin.database().ref(refPath).once('value');
  return snapshot.val();
}

// ---------------------------------------------------------------------------
// Supabase init
// ---------------------------------------------------------------------------

function initSupabase() {
  const result = createSupabaseServiceClient(env);
  if (!result.ok) {
    throw new Error(`Supabase client init failed: ${result.reason}`);
  }
  return result.client;
}

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------

function toEntityArray(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return [];
  return Object.entries(rawMap).map(([id, value]) => ({
    id,
    data: value && typeof value === 'object' ? value : { value },
  }));
}

async function migrateCollection(supabase, table, entities) {
  if (entities.length === 0) return { migrated: 0, skipped: 0 };

  let migrated = 0;
  let skipped = 0;

  // Batch in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    const batch = entities.slice(i, i + BATCH_SIZE).map((entity) => ({
      tenant_id: TENANT_ID,
      id: String(entity.id),
      data: entity.data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (DRY_RUN) {
      migrated += batch.length;
      continue;
    }

    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'tenant_id,id', count: 'exact' });

    if (error) {
      console.error(`  ERROR upserting into ${table}: ${error.message}`);
      skipped += batch.length;
    } else {
      migrated += count || batch.length;
    }
  }

  return { migrated, skipped };
}

async function migrateLifecycleLog(supabase, admin) {
  const raw = await readRtdbPath(admin, RTDB_PATHS.logs.botLifecycle);
  const entries = toEntityArray(raw);
  if (entries.length === 0) return { migrated: 0, skipped: 0 };

  let migrated = 0;
  let skipped = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map((entry) => ({
      tenant_id: TENANT_ID,
      id: String(entry.id),
      bot_id: String(entry.data?.bot_id || ''),
      type: String(entry.data?.type || ''),
      message: String(entry.data?.message || ''),
      details: entry.data?.details || null,
      timestamp_ms: Number(entry.data?.timestamp || Date.now()),
    }));

    if (DRY_RUN) { migrated += batch.length; continue; }

    const { error, count } = await supabase
      .from('bot_lifecycle_log')
      .upsert(batch, { onConflict: 'tenant_id,id', count: 'exact' });

    if (error) {
      console.error(`  ERROR upserting bot_lifecycle_log: ${error.message}`);
      skipped += batch.length;
    } else {
      migrated += count || batch.length;
    }
  }

  return { migrated, skipped };
}

async function migrateArchive(supabase, admin) {
  const raw = await readRtdbPath(admin, RTDB_PATHS.archive);
  const entries = toEntityArray(raw);
  if (entries.length === 0) return { migrated: 0, skipped: 0 };

  let migrated = 0;
  let skipped = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map((entry) => ({
      tenant_id: TENANT_ID,
      id: String(entry.id),
      bot_id: String(entry.data?.bot_id || ''),
      reason: String(entry.data?.reason || 'banned'),
      archived_at_ms: Number(entry.data?.archived_at || Date.now()),
      ban_details: entry.data?.ban_details || null,
      snapshot: entry.data?.snapshot || null,
    }));

    if (DRY_RUN) { migrated += batch.length; continue; }

    const { error, count } = await supabase
      .from('bot_archive')
      .upsert(batch, { onConflict: 'tenant_id,id', count: 'exact' });

    if (error) {
      console.error(`  ERROR upserting bot_archive: ${error.message}`);
      skipped += batch.length;
    } else {
      migrated += count || batch.length;
    }
  }

  return { migrated, skipped };
}

async function migrateFinanceAggregates(supabase, admin) {
  let migrated = 0;

  const dailyStats = await readRtdbPath(admin, RTDB_PATHS.finance.dailyStats);
  if (dailyStats) {
    if (!DRY_RUN) {
      const { error } = await supabase.from('finance_aggregates').upsert({
        tenant_id: TENANT_ID,
        key: 'daily_stats',
        data: dailyStats,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,key' });
      if (error) console.error(`  ERROR upserting daily_stats: ${error.message}`);
      else migrated++;
    } else {
      migrated++;
    }
  }

  const goldPriceHistory = await readRtdbPath(admin, RTDB_PATHS.finance.goldPriceHistory);
  if (goldPriceHistory) {
    if (!DRY_RUN) {
      const { error } = await supabase.from('finance_aggregates').upsert({
        tenant_id: TENANT_ID,
        key: 'gold_price_history',
        data: goldPriceHistory,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,key' });
      if (error) console.error(`  ERROR upserting gold_price_history: ${error.message}`);
      else migrated++;
    } else {
      migrated++;
    }
  }

  return { migrated, skipped: 0 };
}

async function migrateSettings(supabase, admin) {
  const tree = await readRtdbPath(admin, RTDB_PATHS.settings);
  if (!tree) return { migrated: 0, skipped: 0 };

  if (!DRY_RUN) {
    const { error } = await supabase.from('app_settings').upsert({
      tenant_id: TENANT_ID,
      data: tree,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    if (error) {
      console.error(`  ERROR upserting app_settings: ${error.message}`);
      return { migrated: 0, skipped: 1 };
    }
  }

  return { migrated: 1, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`RTDB → Supabase migration${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`Tenant ID: ${TENANT_ID}\n`);

  const admin = initFirebaseAdmin();
  const supabase = initSupabase();
  const results = {};

  // Resources
  const collectionMigrations = [
    { name: 'resources/licenses', path: RTDB_PATHS.resources.licenses, table: 'resources_licenses' },
    { name: 'resources/proxies', path: RTDB_PATHS.resources.proxies, table: 'resources_proxies' },
    { name: 'resources/subscriptions', path: RTDB_PATHS.resources.subscriptions, table: 'resources_subscriptions' },
    { name: 'workspace/notes', path: RTDB_PATHS.workspace.notes, table: 'workspace_notes' },
    { name: 'workspace/calendar', path: RTDB_PATHS.workspace.calendar, table: 'workspace_calendar_events' },
    { name: 'workspace/kanban', path: RTDB_PATHS.workspace.kanban, table: 'workspace_kanban_tasks' },
    { name: 'bots', path: RTDB_PATHS.bots, table: 'bots' },
    { name: 'finance/operations', path: RTDB_PATHS.finance.operations, table: 'finance_operations' },
  ];

  for (const { name, path: rtdbPath, table } of collectionMigrations) {
    process.stdout.write(`Migrating ${name}... `);
    const raw = await readRtdbPath(admin, rtdbPath);
    const entities = toEntityArray(raw);
    const result = await migrateCollection(supabase, table, entities);
    results[name] = { source: entities.length, ...result };
    console.log(`${result.migrated} migrated, ${result.skipped} skipped (source: ${entities.length})`);
  }

  // Bot lifecycle log
  process.stdout.write('Migrating bot_lifecycle_log... ');
  const logResult = await migrateLifecycleLog(supabase, admin);
  results['bot_lifecycle_log'] = logResult;
  console.log(`${logResult.migrated} migrated, ${logResult.skipped} skipped`);

  // Bot archive
  process.stdout.write('Migrating bot_archive... ');
  const archiveResult = await migrateArchive(supabase, admin);
  results['bot_archive'] = archiveResult;
  console.log(`${archiveResult.migrated} migrated, ${archiveResult.skipped} skipped`);

  // Finance aggregates
  process.stdout.write('Migrating finance_aggregates... ');
  const finResult = await migrateFinanceAggregates(supabase, admin);
  results['finance_aggregates'] = finResult;
  console.log(`${finResult.migrated} migrated`);

  // Settings
  process.stdout.write('Migrating app_settings... ');
  const settingsResult = await migrateSettings(supabase, admin);
  results['app_settings'] = settingsResult;
  console.log(`${settingsResult.migrated} migrated`);

  // Summary
  console.log('\n--- Summary ---');
  let totalMigrated = 0;
  let totalSkipped = 0;
  for (const [domain, r] of Object.entries(results)) {
    totalMigrated += r.migrated || 0;
    totalSkipped += r.skipped || 0;
    const sourceInfo = r.source !== undefined ? ` (source: ${r.source})` : '';
    console.log(`  ${domain}: ${r.migrated} migrated, ${r.skipped} skipped${sourceInfo}`);
  }
  console.log(`\nTotal: ${totalMigrated} migrated, ${totalSkipped} skipped`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No data was written. Run without --dry-run to apply.');
  }

  process.exit(totalSkipped > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message || err);
  process.exit(1);
});

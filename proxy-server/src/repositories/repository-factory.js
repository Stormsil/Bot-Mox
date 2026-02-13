/**
 * Repository factory — creates domain repositories based on DATA_BACKEND config.
 *
 * Each repository exposes a uniform interface so routes remain backend-agnostic:
 *
 *   CollectionRepository: { list, getById, create, patch, remove }
 *   BotsRepository:       extends CollectionRepository + { writeLifecycleLog, writeArchiveEntry }
 *   FinanceRepository:    extends CollectionRepository (operations) + { getDailyStats, getGoldPriceHistory }
 *   SettingsRepository:   { read, write } (tree-based, not collection-based)
 *
 * Backends: RTDB (default) and Supabase (when DATA_BACKEND=supabase).
 */

const { RtdbCollectionRepository, readRtdbPath, writeRtdbPath } = require('./rtdb/rtdb-repository');
const { RTDB_PATHS } = require('./rtdb/paths');
const { SupabaseCollectionRepository } = require('./supabase/supabase-collection-repository');
const { createSupabaseServiceClient } = require('./supabase/client');

// ===========================================================================
// RTDB backend
// ===========================================================================

function createRtdbCollectionRepo(admin, path) {
  const repo = new RtdbCollectionRepository(admin, path);
  return {
    list: () => repo.list(),
    getById: (id) => repo.getById(id),
    create: (payload, explicitId) => repo.create(payload, explicitId),
    patch: (id, payload) => repo.patch(id, payload),
    remove: (id) => repo.remove(id),
  };
}

function createRtdbResourcesRepositories(admin) {
  return {
    licenses: createRtdbCollectionRepo(admin, RTDB_PATHS.resources.licenses),
    proxies: createRtdbCollectionRepo(admin, RTDB_PATHS.resources.proxies),
    subscriptions: createRtdbCollectionRepo(admin, RTDB_PATHS.resources.subscriptions),
  };
}

function createRtdbWorkspaceRepositories(admin) {
  return {
    notes: createRtdbCollectionRepo(admin, RTDB_PATHS.workspace.notes),
    calendar: createRtdbCollectionRepo(admin, RTDB_PATHS.workspace.calendar),
    kanban: createRtdbCollectionRepo(admin, RTDB_PATHS.workspace.kanban),
  };
}

function createRtdbBotsRepository(admin) {
  const repo = new RtdbCollectionRepository(admin, RTDB_PATHS.bots);

  return {
    list: () => repo.list(),
    getById: (id) => repo.getById(id),
    create: (payload, explicitId) => repo.create(payload, explicitId),
    patch: (id, payload) => repo.patch(id, payload),
    remove: (id) => repo.remove(id),

    async writeLifecycleLog(botId, type, message, details) {
      const logRef = admin.database().ref(RTDB_PATHS.logs.botLifecycle).push();
      await logRef.set({
        id: logRef.key,
        bot_id: String(botId),
        type: String(type),
        message: String(message),
        details: details || null,
        timestamp: Date.now(),
      });
    },

    async writeArchiveEntry(botId, botSnapshot, banDetails) {
      const archiveRef = admin.database().ref(RTDB_PATHS.archive).push();
      await archiveRef.set({
        id: archiveRef.key,
        bot_id: String(botId),
        reason: 'banned',
        archived_at: Date.now(),
        ban_details: banDetails,
        snapshot: {
          project_id: botSnapshot?.project_id || '',
          character: botSnapshot?.character || null,
          final_level: Number(botSnapshot?.character?.level || 0),
          total_farmed: Number(botSnapshot?.farm?.all_farmed_gold || 0),
          total_earned_gold: Number(botSnapshot?.farm?.all_earned_gold || 0),
          total_runtime_hours: Number(botSnapshot?.monitor?.total_runtime_hours || 0),
        },
      });
    },
  };
}

function createRtdbFinanceRepository(admin) {
  const operationsRepo = new RtdbCollectionRepository(admin, RTDB_PATHS.finance.operations);

  return {
    list: () => operationsRepo.list(),
    getById: (id) => operationsRepo.getById(id),
    create: (payload, explicitId) => operationsRepo.create(payload, explicitId),
    patch: (id, payload) => operationsRepo.patch(id, payload),
    remove: (id) => operationsRepo.remove(id),

    async getDailyStats() {
      return (await readRtdbPath(admin, RTDB_PATHS.finance.dailyStats)) || {};
    },

    async getGoldPriceHistory() {
      return (await readRtdbPath(admin, RTDB_PATHS.finance.goldPriceHistory)) || {};
    },
  };
}

function createRtdbSettingsRepository(admin) {
  return {
    async read(path) {
      return readRtdbPath(admin, path);
    },
    async write(path, payload, options) {
      return writeRtdbPath(admin, path, payload, options);
    },
  };
}

function createRtdbRepositories(admin) {
  return {
    resources: createRtdbResourcesRepositories(admin),
    workspace: createRtdbWorkspaceRepositories(admin),
    bots: createRtdbBotsRepository(admin),
    finance: createRtdbFinanceRepository(admin),
    settings: createRtdbSettingsRepository(admin),
  };
}

// ===========================================================================
// Supabase backend
// ===========================================================================

function createSupabaseCollectionRepo(client, table, tenantId) {
  const repo = new SupabaseCollectionRepository(client, table, tenantId);
  return {
    list: () => repo.list(),
    getById: (id) => repo.getById(id),
    create: (payload, explicitId) => repo.create(payload, explicitId),
    patch: (id, payload) => repo.patch(id, payload),
    remove: (id) => repo.remove(id),
  };
}

function createSupabaseResourcesRepositories(client, tenantId) {
  return {
    licenses: createSupabaseCollectionRepo(client, 'resources_licenses', tenantId),
    proxies: createSupabaseCollectionRepo(client, 'resources_proxies', tenantId),
    subscriptions: createSupabaseCollectionRepo(client, 'resources_subscriptions', tenantId),
  };
}

function createSupabaseWorkspaceRepositories(client, tenantId) {
  return {
    notes: createSupabaseCollectionRepo(client, 'workspace_notes', tenantId),
    calendar: createSupabaseCollectionRepo(client, 'workspace_calendar_events', tenantId),
    kanban: createSupabaseCollectionRepo(client, 'workspace_kanban_tasks', tenantId),
  };
}

function createSupabaseBotsRepository(client, tenantId) {
  const repo = new SupabaseCollectionRepository(client, 'bots', tenantId);
  const { randomUUID } = require('crypto');

  return {
    list: () => repo.list(),
    getById: (id) => repo.getById(id),
    create: (payload, explicitId) => repo.create(payload, explicitId),
    patch: (id, payload) => repo.patch(id, payload),
    remove: (id) => repo.remove(id),

    async writeLifecycleLog(botId, type, message, details) {
      const id = randomUUID();
      const timestampMs = Date.now();
      const { error } = await client
        .from('bot_lifecycle_log')
        .insert({
          tenant_id: tenantId,
          id,
          bot_id: String(botId),
          type: String(type),
          message: String(message),
          details: details || null,
          timestamp_ms: timestampMs,
        });
      if (error) throw new Error(`Supabase writeLifecycleLog error: ${error.message}`);
    },

    async writeArchiveEntry(botId, botSnapshot, banDetails) {
      const id = randomUUID();
      const { error } = await client
        .from('bot_archive')
        .insert({
          tenant_id: tenantId,
          id,
          bot_id: String(botId),
          reason: 'banned',
          archived_at_ms: Date.now(),
          ban_details: banDetails,
          snapshot: {
            project_id: botSnapshot?.project_id || '',
            character: botSnapshot?.character || null,
            final_level: Number(botSnapshot?.character?.level || 0),
            total_farmed: Number(botSnapshot?.farm?.all_farmed_gold || 0),
            total_earned_gold: Number(botSnapshot?.farm?.all_earned_gold || 0),
            total_runtime_hours: Number(botSnapshot?.monitor?.total_runtime_hours || 0),
          },
        });
      if (error) throw new Error(`Supabase writeArchiveEntry error: ${error.message}`);
    },
  };
}

function createSupabaseFinanceRepository(client, tenantId) {
  const repo = new SupabaseCollectionRepository(client, 'finance_operations', tenantId);

  return {
    list: () => repo.list(),
    getById: (id) => repo.getById(id),
    create: (payload, explicitId) => repo.create(payload, explicitId),
    patch: (id, payload) => repo.patch(id, payload),
    remove: (id) => repo.remove(id),

    async getDailyStats() {
      const { data, error } = await client
        .from('finance_aggregates')
        .select('data')
        .eq('tenant_id', tenantId)
        .eq('key', 'daily_stats')
        .maybeSingle();
      if (error) throw new Error(`Supabase getDailyStats error: ${error.message}`);
      return data?.data || {};
    },

    async getGoldPriceHistory() {
      const { data, error } = await client
        .from('finance_aggregates')
        .select('data')
        .eq('tenant_id', tenantId)
        .eq('key', 'gold_price_history')
        .maybeSingle();
      if (error) throw new Error(`Supabase getGoldPriceHistory error: ${error.message}`);
      return data?.data || {};
    },
  };
}

function createSupabaseSettingsRepository(client, tenantId) {
  const SETTINGS_ROOT = 'settings';

  return {
    async read(path) {
      const { data, error } = await client
        .from('app_settings')
        .select('data')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw new Error(`Supabase settings read error: ${error.message}`);

      const tree = data?.data || {};
      const normalizedPath = String(path || '').replace(/^\/+/, '').replace(/\/+$/, '');

      if (!normalizedPath || normalizedPath === SETTINGS_ROOT) {
        return tree;
      }

      // Navigate into the tree for sub-paths like 'settings/vmgenerator'
      const segments = normalizedPath.split('/').filter(Boolean);
      const startIdx = segments[0] === SETTINGS_ROOT ? 1 : 0;
      let current = tree;
      for (let i = startIdx; i < segments.length; i++) {
        if (current == null || typeof current !== 'object') return null;
        current = current[segments[i]];
      }
      return current === undefined ? null : current;
    },

    async write(path, payload, options) {
      const { data: existing } = await client
        .from('app_settings')
        .select('data')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const tree = existing?.data || {};
      const normalizedPath = String(path || '').replace(/^\/+/, '').replace(/\/+$/, '');

      let updatedTree;
      if (!normalizedPath || normalizedPath === SETTINGS_ROOT) {
        updatedTree = options?.merge ? { ...tree, ...payload } : payload;
      } else {
        const segments = normalizedPath.split('/').filter(Boolean);
        const startIdx = segments[0] === SETTINGS_ROOT ? 1 : 0;
        updatedTree = structuredClone(tree);

        let target = updatedTree;
        for (let i = startIdx; i < segments.length - 1; i++) {
          if (target[segments[i]] == null || typeof target[segments[i]] !== 'object') {
            target[segments[i]] = {};
          }
          target = target[segments[i]];
        }

        const lastSeg = segments[segments.length - 1];
        if (lastSeg) {
          if (options?.merge && target[lastSeg] && typeof target[lastSeg] === 'object') {
            target[lastSeg] = { ...target[lastSeg], ...payload };
          } else {
            target[lastSeg] = payload;
          }
        }
      }

      const { error } = await client
        .from('app_settings')
        .upsert(
          {
            tenant_id: tenantId,
            data: updatedTree,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        );
      if (error) throw new Error(`Supabase settings write error: ${error.message}`);
      return updatedTree;
    },
  };
}

function createSupabaseRepositories(env) {
  const tenantId = String(env.defaultTenantId || 'default').trim() || 'default';
  const clientResult = createSupabaseServiceClient(env);

  if (!clientResult.ok) {
    throw new Error(`Cannot create Supabase repositories: ${clientResult.reason}`);
  }

  const client = clientResult.client;

  return {
    resources: createSupabaseResourcesRepositories(client, tenantId),
    workspace: createSupabaseWorkspaceRepositories(client, tenantId),
    bots: createSupabaseBotsRepository(client, tenantId),
    finance: createSupabaseFinanceRepository(client, tenantId),
    settings: createSupabaseSettingsRepository(client, tenantId),
  };
}

// ===========================================================================
// Factory entry point
// ===========================================================================

/**
 * Create all domain repositories for the given backend configuration.
 *
 * @param {{ admin: object, env?: object }} params
 * @returns {{
 *   resources: { licenses, proxies, subscriptions },
 *   workspace: { notes, calendar, kanban },
 *   bots: object,
 *   finance: object,
 *   settings: object,
 * }}
 */
function createRepositories({ admin, env }) {
  if (env?.dataBackend === 'supabase') {
    return createSupabaseRepositories(env);
  }

  return createRtdbRepositories(admin);
}

module.exports = {
  createRepositories,
};

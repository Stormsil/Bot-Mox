/**
 * Generic Supabase-backed collection repository.
 *
 * Stores entity data as JSONB in a table with columns:
 *   (tenant_id TEXT, id TEXT, data JSONB, created_at, updated_at)
 *
 * Matches the same interface as RtdbCollectionRepository:
 *   { list, getById, create, patch, remove }
 */

const { randomUUID } = require('crypto');

// ---------------------------------------------------------------------------
// Deep-path merge (matches Firebase update() semantics)
// ---------------------------------------------------------------------------

/**
 * Apply a patch object to a base object.
 * Keys containing '/' are treated as deep paths (Firebase convention).
 * Keys with null values remove the key from the result.
 */
function applyPatch(base, patch) {
  const result = structuredClone(base || {});

  for (const [key, value] of Object.entries(patch)) {
    if (key.includes('/')) {
      const segments = key.split('/').filter(Boolean);
      if (segments.length === 0) continue;

      let target = result;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (target[seg] == null || typeof target[seg] !== 'object') {
          target[seg] = {};
        }
        target = target[seg];
      }

      const lastSeg = segments[segments.length - 1];
      if (value === null || value === undefined) {
        delete target[lastSeg];
      } else {
        target[lastSeg] = value;
      }
    } else if (value === null || value === undefined) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

class SupabaseCollectionRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   * @param {string} table  — Supabase table name
   * @param {string} tenantId
   */
  constructor(client, table, tenantId = 'default') {
    this.client = client;
    this.table = table;
    this.tenantId = tenantId;
  }

  /** @returns {Promise<Array<object>>} */
  async list() {
    const { data, error } = await this.client
      .from(this.table)
      .select('id, data')
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`Supabase list error (${this.table}): ${error.message}`);
    return (data || []).map((row) => ({ id: row.id, ...row.data }));
  }

  /** @returns {Promise<object|null>} */
  async getById(id) {
    const { data, error } = await this.client
      .from(this.table)
      .select('id, data')
      .eq('tenant_id', this.tenantId)
      .eq('id', String(id))
      .maybeSingle();

    if (error) throw new Error(`Supabase getById error (${this.table}): ${error.message}`);
    if (!data) return null;
    return { id: data.id, ...data.data };
  }

  /** @returns {Promise<object>} */
  async create(payload, explicitId) {
    const id = explicitId || randomUUID();
    const entityData = { ...payload, id };

    const { data, error } = await this.client
      .from(this.table)
      .upsert(
        {
          tenant_id: this.tenantId,
          id: String(id),
          data: entityData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,id' }
      )
      .select('id, data')
      .single();

    if (error) throw new Error(`Supabase create error (${this.table}): ${error.message}`);
    return { id: data.id, ...data.data };
  }

  /** @returns {Promise<object|null>} */
  async patch(id, payload) {
    const existing = await this.getById(id);
    if (!existing) return null;

    const merged = applyPatch(existing, payload);

    const { data, error } = await this.client
      .from(this.table)
      .update({
        data: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', this.tenantId)
      .eq('id', String(id))
      .select('id, data')
      .single();

    if (error) throw new Error(`Supabase patch error (${this.table}): ${error.message}`);
    return { id: data.id, ...data.data };
  }

  /** @returns {Promise<boolean>} */
  async remove(id) {
    const { error, count } = await this.client
      .from(this.table)
      .delete({ count: 'exact' })
      .eq('tenant_id', this.tenantId)
      .eq('id', String(id));

    if (error) throw new Error(`Supabase remove error (${this.table}): ${error.message}`);
    return (count || 0) > 0;
  }
}

module.exports = {
  SupabaseCollectionRepository,
  applyPatch,
};

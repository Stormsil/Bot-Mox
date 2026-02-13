const { createSupabaseServiceClient } = require('../../repositories/supabase/client');

class SecretsServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'SecretsServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'SECRETS_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function createSecretsService({ env }) {
  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new SecretsServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function createSecret({ tenantId, label, ciphertext, alg, keyId, nonce, aadMeta, createdBy }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';

    const { data, error } = await client
      .from('secrets_ciphertext')
      .insert({
        tenant_id: normalizedTenantId,
        label: String(label || '').trim(),
        ciphertext: String(ciphertext || '').trim(),
        alg: String(alg || 'AES-256-GCM').trim(),
        key_id: String(keyId || '').trim(),
        nonce: String(nonce || '').trim(),
        aad_meta: aadMeta && typeof aadMeta === 'object' ? aadMeta : {},
        created_by: createdBy ? String(createdBy).trim() : null,
      })
      .select('id, tenant_id, label, alg, key_id, aad_meta, created_at, updated_at')
      .single();

    if (error) {
      throw new SecretsServiceError(500, 'DB_ERROR', `Failed to store secret: ${error.message}`);
    }

    // Never return ciphertext or nonce in the response
    return data;
  }

  async function getSecretMeta({ tenantId, secretId }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedSecretId = String(secretId || '').trim();

    if (!normalizedSecretId) {
      throw new SecretsServiceError(400, 'BAD_REQUEST', 'secret_id is required');
    }

    const { data, error } = await client
      .from('secrets_ciphertext')
      .select('id, tenant_id, label, alg, key_id, aad_meta, rotated_at, created_at, updated_at')
      .eq('id', normalizedSecretId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (error || !data) {
      throw new SecretsServiceError(404, 'SECRET_NOT_FOUND', 'Secret not found');
    }

    // Never return ciphertext or nonce
    return data;
  }

  async function rotateSecret({ tenantId, secretId, ciphertext, alg, keyId, nonce, aadMeta }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedSecretId = String(secretId || '').trim();

    if (!normalizedSecretId) {
      throw new SecretsServiceError(400, 'BAD_REQUEST', 'secret_id is required');
    }

    // Verify secret exists and belongs to tenant
    const { data: existing, error: lookupError } = await client
      .from('secrets_ciphertext')
      .select('id, tenant_id')
      .eq('id', normalizedSecretId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (lookupError || !existing) {
      throw new SecretsServiceError(404, 'SECRET_NOT_FOUND', 'Secret not found');
    }

    const updatePayload = {
      ciphertext: String(ciphertext || '').trim(),
      key_id: String(keyId || '').trim(),
      nonce: String(nonce || '').trim(),
      rotated_at: new Date().toISOString(),
    };

    if (alg) {
      updatePayload.alg = String(alg).trim();
    }

    if (aadMeta && typeof aadMeta === 'object') {
      updatePayload.aad_meta = aadMeta;
    }

    const { data, error } = await client
      .from('secrets_ciphertext')
      .update(updatePayload)
      .eq('id', normalizedSecretId)
      .eq('tenant_id', normalizedTenantId)
      .select('id, tenant_id, label, alg, key_id, aad_meta, rotated_at, created_at, updated_at')
      .single();

    if (error) {
      throw new SecretsServiceError(500, 'DB_ERROR', `Failed to rotate secret: ${error.message}`);
    }

    return data;
  }

  async function createBinding({ tenantId, scopeType, scopeId, secretRef, fieldName }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';

    const { data, error } = await client
      .from('secret_bindings')
      .upsert(
        {
          tenant_id: normalizedTenantId,
          scope_type: String(scopeType || '').trim(),
          scope_id: String(scopeId || '').trim(),
          secret_ref: String(secretRef || '').trim(),
          field_name: String(fieldName || '').trim(),
        },
        { onConflict: 'tenant_id,scope_type,scope_id,field_name' }
      )
      .select('id, tenant_id, scope_type, scope_id, secret_ref, field_name, created_at, updated_at')
      .single();

    if (error) {
      throw new SecretsServiceError(500, 'DB_ERROR', `Failed to create binding: ${error.message}`);
    }

    return data;
  }

  async function listBindings({ tenantId, scopeType, scopeId }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';

    let query = client
      .from('secret_bindings')
      .select('id, tenant_id, scope_type, scope_id, secret_ref, field_name, created_at, updated_at')
      .eq('tenant_id', normalizedTenantId);

    if (scopeType) {
      query = query.eq('scope_type', String(scopeType).trim());
    }
    if (scopeId) {
      query = query.eq('scope_id', String(scopeId).trim());
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new SecretsServiceError(500, 'DB_ERROR', `Failed to list bindings: ${error.message}`);
    }

    return data || [];
  }

  return {
    createSecret,
    getSecretMeta,
    rotateSecret,
    createBinding,
    listBindings,
  };
}

module.exports = {
  createSecretsService,
  SecretsServiceError,
};

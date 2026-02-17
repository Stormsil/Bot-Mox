'use strict';

const yaml = require('js-yaml');
const { createSupabaseServiceClient } = require('../../repositories/supabase/client');
const { playbookContentStructureSchema } = require('../../contracts/schemas');

class PlaybookServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'PlaybookServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'PLAYBOOK_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function createPlaybookService({ env }) {
  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new PlaybookServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function listPlaybooks({ tenantId, userId }) {
    const client = getClient();
    const { data, error } = await client
      .from('playbooks')
      .select('*')
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('user_id', String(userId))
      .order('created_at', { ascending: true });

    if (error) {
      throw new PlaybookServiceError(500, 'DB_ERROR', `Failed to list playbooks: ${error.message}`);
    }
    return data || [];
  }

  async function getPlaybook({ tenantId, userId, playbookId }) {
    const client = getClient();
    const { data, error } = await client
      .from('playbooks')
      .select('*')
      .eq('id', String(playbookId))
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('user_id', String(userId))
      .single();

    if (error || !data) {
      throw new PlaybookServiceError(404, 'PLAYBOOK_NOT_FOUND', 'Playbook not found');
    }
    return data;
  }

  async function getDefaultPlaybook({ tenantId, userId }) {
    const client = getClient();
    const { data, error } = await client
      .from('playbooks')
      .select('*')
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('user_id', String(userId))
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new PlaybookServiceError(500, 'DB_ERROR', `Failed to get default playbook: ${error.message}`);
    }
    return data || null;
  }

  async function createPlaybook({ tenantId, userId, name, isDefault, content }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || 'default');
    const normalizedUserId = String(userId);

    if (isDefault) {
      await client
        .from('playbooks')
        .update({ is_default: false })
        .eq('tenant_id', normalizedTenantId)
        .eq('user_id', normalizedUserId)
        .eq('is_default', true);
    }

    const { data, error } = await client
      .from('playbooks')
      .insert({
        tenant_id: normalizedTenantId,
        user_id: normalizedUserId,
        name: String(name).trim(),
        is_default: Boolean(isDefault),
        content: String(content),
      })
      .select('*')
      .single();

    if (error) {
      if (String(error.code) === '23505') {
        throw new PlaybookServiceError(409, 'DUPLICATE_NAME', `Playbook name "${name}" already exists`);
      }
      throw new PlaybookServiceError(500, 'DB_ERROR', `Failed to create playbook: ${error.message}`);
    }
    return data;
  }

  async function updatePlaybook({ tenantId, userId, playbookId, updates }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || 'default');
    const normalizedUserId = String(userId);

    const patch = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) patch.name = String(updates.name).trim();
    if (updates.content !== undefined) patch.content = String(updates.content);
    if (updates.is_default !== undefined) {
      patch.is_default = Boolean(updates.is_default);
      if (patch.is_default) {
        await client
          .from('playbooks')
          .update({ is_default: false })
          .eq('tenant_id', normalizedTenantId)
          .eq('user_id', normalizedUserId)
          .eq('is_default', true);
      }
    }

    const { data, error } = await client
      .from('playbooks')
      .update(patch)
      .eq('id', String(playbookId))
      .eq('tenant_id', normalizedTenantId)
      .eq('user_id', normalizedUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new PlaybookServiceError(404, 'PLAYBOOK_NOT_FOUND', 'Playbook not found');
    }
    return data;
  }

  async function deletePlaybook({ tenantId, userId, playbookId }) {
    const client = getClient();
    const { error } = await client
      .from('playbooks')
      .delete()
      .eq('id', String(playbookId))
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('user_id', String(userId));

    if (error) {
      throw new PlaybookServiceError(500, 'DB_ERROR', `Failed to delete playbook: ${error.message}`);
    }
  }

  function validatePlaybookContent(yamlString) {
    const warnings = [];
    let parsed;

    try {
      parsed = yaml.load(yamlString);
    } catch (err) {
      return {
        valid: false,
        errors: [{ message: `YAML parse error: ${err.message}` }],
        warnings,
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        errors: [{ message: 'Playbook must be a YAML object with name, roles, etc.' }],
        warnings,
      };
    }

    const result = playbookContentStructureSchema.safeParse(parsed);
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        warnings,
      };
    }

    const knownRoles = new Set([
      'base-system', 'privacy-debloat', 'network-config', 'common-apps',
      'personalization', 'nvidia-driver', 'syncthing', 'proxifier',
      'post-reboot',
    ]);

    for (const role of result.data.roles) {
      if (!knownRoles.has(role.role)) {
        warnings.push({ message: `Unknown role "${role.role}" — ensure a matching role exists in Winsible` });
      }
    }

    return { valid: true, errors: [], warnings, parsed: result.data };
  }

  return {
    listPlaybooks,
    getPlaybook,
    getDefaultPlaybook,
    createPlaybook,
    updatePlaybook,
    deletePlaybook,
    validatePlaybookContent,
  };
}

module.exports = {
  createPlaybookService,
  PlaybookServiceError,
};

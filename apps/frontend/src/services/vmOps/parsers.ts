import { ApiClientError } from '../apiClient';

interface CommandEnvelope {
  id: string;
  tenant_id: string;
  agent_id: string;
  command_type: string;
  status: string;
  queued_at: string;
  expires_at: string;
}

export interface CommandStatus extends CommandEnvelope {
  payload?: Record<string, unknown>;
  result?: unknown;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_by?: string | null;
}

export interface AgentSummary {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
}

export interface AgentPairingDefaults {
  url?: string;
  username?: string;
  node?: string;
}

export interface AgentPairingRecord {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  pairing_code: string;
  pairing_expires_at: string;
  pairing_bundle?: string;
  pairing_uri?: string;
  pairing_url?: string;
  server_url?: string;
  proxmox_defaults?: AgentPairingDefaults;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asOptionalString(value: unknown): string | undefined {
  const normalized = asString(value).trim();
  return normalized ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function toAgentSummaryList(payload: unknown): AgentSummary[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      const record = asRecord(item);
      const id = asString(record.id).trim();
      if (!id) {
        return null;
      }

      const name = asString(record.name).trim() || id;
      const status = asString(record.status).trim();
      const lastSeenAtRaw = record.last_seen_at;
      const last_seen_at =
        typeof lastSeenAtRaw === 'string' && lastSeenAtRaw.trim() ? lastSeenAtRaw : null;

      return {
        id,
        name,
        status,
        last_seen_at,
      };
    })
    .filter((item): item is AgentSummary => item !== null);
}

export function toAgentPairingRecord(payload: unknown): AgentPairingRecord {
  const record = asRecord(payload);
  const id = asString(record.id).trim();
  const tenant_id = asString(record.tenant_id).trim();
  const name = asString(record.name).trim();
  const status = asString(record.status).trim();
  const pairing_code = asString(record.pairing_code).trim();
  const pairing_expires_at = asString(record.pairing_expires_at).trim();

  if (!id || !pairing_code) {
    throw new ApiClientError('Invalid pairing response payload', {
      status: 500,
      code: 'INVALID_RESPONSE',
      details: payload,
    });
  }

  const proxmoxDefaults = asRecord(record.proxmox_defaults);
  const proxmox_defaults =
    Object.keys(proxmoxDefaults).length > 0
      ? {
          url: asOptionalString(proxmoxDefaults.url),
          username: asOptionalString(proxmoxDefaults.username),
          node: asOptionalString(proxmoxDefaults.node),
        }
      : undefined;

  return {
    id,
    tenant_id,
    name,
    status,
    pairing_code,
    pairing_expires_at,
    pairing_bundle: asOptionalString(record.pairing_bundle),
    pairing_uri: asOptionalString(record.pairing_uri),
    pairing_url: asOptionalString(record.pairing_url),
    server_url: asOptionalString(record.server_url),
    proxmox_defaults,
  };
}

export function toCommandStatus(payload: unknown): CommandStatus {
  const record = asRecord(payload);
  const id = asString(record.id).trim();
  const status = asString(record.status).trim();
  const command_type = asString(record.command_type).trim();
  const tenant_id = asString(record.tenant_id).trim();
  const agent_id = asString(record.agent_id).trim();
  const queued_at = asString(record.queued_at).trim();
  const expires_at = asString(record.expires_at).trim();

  if (!id || !status || !command_type) {
    throw new ApiClientError('Invalid VM ops command payload', {
      status: 500,
      code: 'INVALID_RESPONSE',
      details: payload,
    });
  }

  return {
    id,
    status,
    command_type,
    tenant_id,
    agent_id,
    queued_at,
    expires_at,
    payload:
      record.payload && typeof record.payload === 'object'
        ? (record.payload as Record<string, unknown>)
        : undefined,
    result: record.result,
    error_message: asOptionalString(record.error_message),
    started_at: asOptionalString(record.started_at),
    completed_at: asOptionalString(record.completed_at),
    created_by: asOptionalString(record.created_by) ?? null,
  };
}

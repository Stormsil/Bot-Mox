export type Role = 'user' | 'admin' | 'infra' | 'agent';

export interface ApiSuccessEnvelope<TData, TMeta = Record<string, unknown>> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<TData, TMeta = Record<string, unknown>> =
  | ApiSuccessEnvelope<TData, TMeta>
  | ApiErrorEnvelope;

export interface AuthIdentity {
  uid: string;
  email: string;
  roles: Role[];
}

export interface AgentCommandPayload {
  [key: string]: unknown;
}

export interface AgentCommandRecord {
  id: string;
  tenant_id: string;
  agent_id: string;
  command_type: string;
  payload: AgentCommandPayload;
  status: 'queued' | 'dispatched' | 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  result?: Record<string, unknown> | null;
  error_message?: string | null;
  queued_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface HealthPayload {
  service: string;
  timestamp: string;
  ready?: boolean;
  checks?: Record<string, unknown>;
}

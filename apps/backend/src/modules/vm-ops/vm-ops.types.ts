export type VmCommandStatus =
  | 'queued'
  | 'dispatched'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'cancelled';

export const TERMINAL_STATUSES: ReadonlySet<VmCommandStatus> = new Set([
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

export interface VmCommandRecord {
  id: string;
  tenant_id: string;
  agent_id: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: VmCommandStatus;
  queued_at: string;
  expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result?: unknown | null;
  error_message?: string | null;
  created_by?: string | null;
}

export interface VmCommandEvent {
  event_id: number;
  event_type: 'vm-command';
  tenant_id: string;
  server_time: string;
  command: VmCommandRecord;
}

export interface Waiter {
  tenantId: string;
  agentId: string;
  resolve: (command: VmCommandRecord | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

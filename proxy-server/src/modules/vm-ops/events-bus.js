const { EventEmitter } = require('events');

const MAX_BUFFERED_EVENTS = 5_000;

const emitter = new EventEmitter();
emitter.setMaxListeners(1_000);

let nextEventId = 1;
const ringBuffer = [];

function normalizeTenantId(value) {
  return String(value || '').trim() || 'default';
}

function normalizeCommandPayload(command) {
  if (!command || typeof command !== 'object') {
    return null;
  }

  const normalized = {
    id: String(command.id || '').trim(),
    tenant_id: normalizeTenantId(command.tenant_id),
    agent_id: String(command.agent_id || '').trim(),
    command_type: String(command.command_type || '').trim(),
    status: String(command.status || '').trim(),
    payload: command.payload && typeof command.payload === 'object' ? command.payload : {},
    result: command.result,
    error_message: command.error_message === undefined ? undefined : String(command.error_message || '').trim(),
    queued_at: command.queued_at || null,
    started_at: command.started_at || null,
    completed_at: command.completed_at || null,
    expires_at: command.expires_at || null,
    created_by: command.created_by === undefined ? null : String(command.created_by || '').trim() || null,
  };

  return normalized.id ? normalized : null;
}

function pushToRingBuffer(event) {
  ringBuffer.push(event);
  if (ringBuffer.length > MAX_BUFFERED_EVENTS) {
    ringBuffer.splice(0, ringBuffer.length - MAX_BUFFERED_EVENTS);
  }
}

function publishVmOpsCommandEvent({ eventType = 'command.updated', tenantId, command }) {
  const normalizedCommand = normalizeCommandPayload(command);
  if (!normalizedCommand) {
    return null;
  }

  const event = {
    event_id: nextEventId++,
    event_type: String(eventType || 'command.updated').trim() || 'command.updated',
    tenant_id: normalizeTenantId(tenantId || normalizedCommand.tenant_id),
    command: normalizedCommand,
    server_time: new Date().toISOString(),
  };

  pushToRingBuffer(event);
  emitter.emit('vm-ops-command', event);
  return event;
}

function subscribeVmOpsCommandEvents(listener) {
  if (typeof listener !== 'function') {
    return () => undefined;
  }

  emitter.on('vm-ops-command', listener);
  return () => {
    emitter.off('vm-ops-command', listener);
  };
}

function listVmOpsCommandEventsSince(lastEventId) {
  const normalized = Number(lastEventId);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return [];
  }

  return ringBuffer.filter((event) => Number(event.event_id) > normalized);
}

module.exports = {
  publishVmOpsCommandEvent,
  subscribeVmOpsCommandEvents,
  listVmOpsCommandEventsSince,
};


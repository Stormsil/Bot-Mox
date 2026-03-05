import { randomUUID } from 'node:crypto';

export const DOMAIN_EVENT_VERSION = 1 as const;

export const DOMAIN_EVENT_TYPES = {
  BOT_DELETE_REQUESTED: 'bot.delete.requested',
  BOT_DELETED: 'bot.deleted',
  BOT_DELETE_FAILED: 'bot.delete.failed',
  VM_DELETE_REQUESTED: 'vm.delete.requested',
  VM_DELETED: 'vm.deleted',
  VM_DELETE_FAILED: 'vm.delete.failed',
  RESOURCE_DELETE_REQUESTED: 'resource.delete.requested',
  RESOURCE_DELETED: 'resource.deleted',
  RESOURCE_DELETE_FAILED: 'resource.delete.failed',
} as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];

export interface DomainEventEnvelope<TType extends DomainEventType, TPayload> {
  eventId: string;
  type: TType;
  version: number;
  tenantId: string;
  aggregateId: string;
  occurredAt: string;
  payload: TPayload;
}

type DeleteRequestPayload = {
  reason?: string;
};

type DeleteFailedPayload = {
  reason: string;
  details?: string;
};

export type BotDeleteRequestedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.BOT_DELETE_REQUESTED,
  DeleteRequestPayload & { botId: string }
>;
export type BotDeletedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.BOT_DELETED,
  { botId: string }
>;
export type BotDeleteFailedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.BOT_DELETE_FAILED,
  DeleteFailedPayload & { botId: string }
>;

export type VmDeleteRequestedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.VM_DELETE_REQUESTED,
  DeleteRequestPayload & { node: string; vmid: string }
>;
export type VmDeletedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.VM_DELETED,
  { node: string; vmid: string }
>;
export type VmDeleteFailedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.VM_DELETE_FAILED,
  DeleteFailedPayload & { node: string; vmid: string }
>;

export type ResourceDeleteRequestedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.RESOURCE_DELETE_REQUESTED,
  DeleteRequestPayload & { kind: string; resourceId: string }
>;
export type ResourceDeletedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.RESOURCE_DELETED,
  { kind: string; resourceId: string }
>;
export type ResourceDeleteFailedEvent = DomainEventEnvelope<
  typeof DOMAIN_EVENT_TYPES.RESOURCE_DELETE_FAILED,
  DeleteFailedPayload & { kind: string; resourceId: string }
>;

export type DurableDomainEvent =
  | BotDeleteRequestedEvent
  | BotDeletedEvent
  | BotDeleteFailedEvent
  | VmDeleteRequestedEvent
  | VmDeletedEvent
  | VmDeleteFailedEvent
  | ResourceDeleteRequestedEvent
  | ResourceDeletedEvent
  | ResourceDeleteFailedEvent;

export type PublishDomainEventInput = Omit<
  DurableDomainEvent,
  'eventId' | 'version' | 'occurredAt'
> & {
  eventId?: string;
  version?: number;
  occurredAt?: string;
};

export function createDomainEvent(input: PublishDomainEventInput): DurableDomainEvent {
  return {
    ...input,
    eventId: String(input.eventId || '').trim() || randomUUID(),
    version: Number.isFinite(input.version) ? Number(input.version) : DOMAIN_EVENT_VERSION,
    occurredAt: String(input.occurredAt || '').trim() || new Date().toISOString(),
  } as DurableDomainEvent;
}

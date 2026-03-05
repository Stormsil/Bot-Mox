import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventOutboxRepository } from './domain-event-outbox.repository';
import {
  type BotDeletedEvent,
  DOMAIN_EVENT_TYPES,
  type DomainEventType,
  type DurableDomainEvent,
} from './domain-events.contracts';
import { DurableEventBusService } from './durable-event-bus.service';
import { EventConsumerIdempotencyRepository } from './event-consumer-idempotency.repository';
import { EventConsumerIdempotencyService } from './event-consumer-idempotency.service';
import { OutboxRelayService } from './outbox-relay.service';

type OutboxInMemoryRow = {
  id: string;
  eventType: DomainEventType;
  attempts: number;
  maxAttempts: number;
  payload: DurableDomainEvent;
  status: 'pending' | 'processing' | 'published' | 'failed';
  lastError: string | null;
};

class InMemoryOutboxRepository {
  rows: OutboxInMemoryRow[] = [];
  nextId = 1;

  async enqueue(event: DurableDomainEvent, maxAttempts: number): Promise<string> {
    const id = `outbox-${this.nextId}`;
    this.nextId += 1;
    this.rows.push({
      id,
      eventType: event.type,
      attempts: 0,
      maxAttempts,
      payload: event,
      status: 'pending',
      lastError: null,
    });
    return id;
  }

  async claimRelayBatch(input: { limit: number }): Promise<
    Array<{
      id: string;
      eventType: DomainEventType;
      attempts: number;
      maxAttempts: number;
      payload: DurableDomainEvent;
    }>
  > {
    const batch = this.rows.filter((row) => row.status === 'pending').slice(0, input.limit);
    for (const row of batch) {
      row.status = 'processing';
    }
    return batch.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      payload: row.payload,
    }));
  }

  async markPublished(id: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id);
    if (!row) {
      return;
    }
    row.attempts += 1;
    row.status = 'published';
    row.lastError = null;
  }

  async scheduleRetry(input: { id: string; errorMessage: string }): Promise<void> {
    const row = this.rows.find((item) => item.id === input.id);
    if (!row) {
      return;
    }
    row.attempts += 1;
    row.status = 'pending';
    row.lastError = input.errorMessage;
  }

  async markFailed(input: { id: string; errorMessage: string }): Promise<void> {
    const row = this.rows.find((item) => item.id === input.id);
    if (!row) {
      return;
    }
    row.attempts += 1;
    row.status = 'failed';
    row.lastError = input.errorMessage;
  }
}

class InMemoryIdempotencyRepository {
  private readonly records = new Map<string, 'processing' | 'processed'>();

  private key(eventId: string, consumer: string): string {
    return `${eventId}:${consumer}`;
  }

  async acquire(eventId: string, consumer: string): Promise<boolean> {
    const key = this.key(eventId, consumer);
    if (this.records.has(key)) {
      return false;
    }
    this.records.set(key, 'processing');
    return true;
  }

  async markProcessed(eventId: string, consumer: string): Promise<void> {
    this.records.set(this.key(eventId, consumer), 'processed');
  }

  async release(eventId: string, consumer: string): Promise<void> {
    const key = this.key(eventId, consumer);
    if (this.records.get(key) === 'processing') {
      this.records.delete(key);
    }
  }
}

function createEventingHarness(): {
  outbox: InMemoryOutboxRepository;
  idempotency: EventConsumerIdempotencyService;
  emitter: EventEmitter2;
  bus: DurableEventBusService;
  relay: OutboxRelayService;
} {
  const outbox = new InMemoryOutboxRepository();
  const idempotencyRepository = new InMemoryIdempotencyRepository();
  const idempotency = new EventConsumerIdempotencyService(
    idempotencyRepository as unknown as EventConsumerIdempotencyRepository,
  );
  const emitter = new EventEmitter2();
  const bus = new DurableEventBusService(outbox as unknown as DomainEventOutboxRepository);
  const relay = new OutboxRelayService(outbox as unknown as DomainEventOutboxRepository, emitter);
  return {
    outbox,
    idempotency,
    emitter,
    bus,
    relay,
  };
}

test('Eventing durable publish-consume happy path', async () => {
  const harness = createEventingHarness();
  let sideEffects = 0;

  harness.emitter.on(DOMAIN_EVENT_TYPES.BOT_DELETED, async (event: BotDeletedEvent) => {
    await harness.idempotency.runOnce({
      eventId: event.eventId,
      consumer: 'test.bot-deleted.v1',
      handler: async () => {
        sideEffects += 1;
      },
    });
  });

  await harness.bus.publish({
    type: DOMAIN_EVENT_TYPES.BOT_DELETED,
    tenantId: 'tenant-a',
    aggregateId: 'bot-1',
    payload: { botId: 'bot-1' },
  });

  await harness.relay.processDueEvents();

  assert.equal(sideEffects, 1);
  assert.equal(harness.outbox.rows.length, 1);
  assert.equal(harness.outbox.rows[0]?.status, 'published');
  assert.equal(harness.outbox.rows[0]?.attempts, 1);
});

test('Eventing idempotency prevents duplicate side effects on duplicate delivery', async () => {
  const harness = createEventingHarness();
  let sideEffects = 0;

  harness.emitter.on(DOMAIN_EVENT_TYPES.BOT_DELETED, async (event: BotDeletedEvent) => {
    await harness.idempotency.runOnce({
      eventId: event.eventId,
      consumer: 'test.bot-deleted.v1',
      handler: async () => {
        sideEffects += 1;
      },
    });
  });

  const duplicateEventId = '00000000-0000-4000-8000-000000000001';
  await harness.bus.publish({
    eventId: duplicateEventId,
    type: DOMAIN_EVENT_TYPES.BOT_DELETED,
    tenantId: 'tenant-a',
    aggregateId: 'bot-dup',
    payload: { botId: 'bot-dup' },
  });
  await harness.bus.publish({
    eventId: duplicateEventId,
    type: DOMAIN_EVENT_TYPES.BOT_DELETED,
    tenantId: 'tenant-a',
    aggregateId: 'bot-dup',
    payload: { botId: 'bot-dup' },
  });

  await harness.relay.processDueEvents();

  assert.equal(sideEffects, 1);
  assert.equal(harness.outbox.rows[0]?.status, 'published');
  assert.equal(harness.outbox.rows[1]?.status, 'published');
});

test('Eventing relay retries transient handler failures and succeeds', async () => {
  const harness = createEventingHarness();
  let invocationCount = 0;
  let sideEffects = 0;

  harness.emitter.on(DOMAIN_EVENT_TYPES.BOT_DELETED, async (event: BotDeletedEvent) => {
    await harness.idempotency.runOnce({
      eventId: event.eventId,
      consumer: 'test.bot-deleted.v1',
      handler: async () => {
        invocationCount += 1;
        if (invocationCount === 1) {
          throw new Error('transient failure');
        }
        sideEffects += 1;
      },
    });
  });

  await harness.bus.publish({
    type: DOMAIN_EVENT_TYPES.BOT_DELETED,
    tenantId: 'tenant-a',
    aggregateId: 'bot-retry',
    payload: { botId: 'bot-retry' },
  });

  await harness.relay.processDueEvents();
  assert.equal(harness.outbox.rows[0]?.status, 'pending');
  assert.equal(harness.outbox.rows[0]?.attempts, 1);

  await harness.relay.processDueEvents();
  assert.equal(harness.outbox.rows[0]?.status, 'published');
  assert.equal(harness.outbox.rows[0]?.attempts, 2);
  assert.equal(sideEffects, 1);
});

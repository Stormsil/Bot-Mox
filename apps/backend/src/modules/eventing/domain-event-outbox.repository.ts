import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import type { DurableDomainEvent } from './domain-events.contracts';

export interface OutboxEventRow {
  id: string;
  eventType: string;
  attempts: number;
  maxAttempts: number;
  payload: DurableDomainEvent;
}

@Injectable()
export class DomainEventOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(event: DurableDomainEvent, maxAttempts: number): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      insert into public.domain_event_outbox (
        tenant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        event_version,
        payload,
        status,
        attempts,
        max_attempts,
        next_attempt_at,
        created_at,
        updated_at
      ) values (
        ${event.tenantId},
        ${event.type.split('.')[0] || 'domain'},
        ${event.aggregateId},
        ${event.type},
        ${event.version},
        ${JSON.stringify(event)}::jsonb,
        'pending',
        0,
        ${Math.max(1, Math.trunc(maxAttempts))},
        now(),
        now(),
        now()
      )
      returning id
    `);
    return String(rows[0]?.id || '');
  }

  async claimRelayBatch(input: {
    limit: number;
    processingStaleAfterMs: number;
  }): Promise<OutboxEventRow[]> {
    const limit = Math.max(1, Math.trunc(input.limit));
    const processingStaleAfterMs = Math.max(1_000, Math.trunc(input.processingStaleAfterMs));
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      with candidates as (
        select id
        from public.domain_event_outbox
        where next_attempt_at <= now()
          and (
            status = 'pending'
            or (
              status = 'processing'
              and updated_at <= now() - (${processingStaleAfterMs} * interval '1 millisecond')
            )
          )
        order by next_attempt_at asc, created_at asc
        limit ${limit}
        for update skip locked
      )
      update public.domain_event_outbox as outbox
      set status = 'processing',
          updated_at = now()
      from candidates
      where outbox.id = candidates.id
      returning outbox.id, outbox.event_type as "eventType", outbox.attempts, outbox.max_attempts as "maxAttempts", outbox.payload
    `);
    return rows.map((row) => ({
      id: String(row.id),
      eventType: String(row.eventType),
      attempts: Number(row.attempts || 0),
      maxAttempts: Number(row.maxAttempts || 0),
      payload: row.payload as DurableDomainEvent,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      update public.domain_event_outbox
      set status = 'published',
          attempts = attempts + 1,
          last_error = null,
          published_at = now(),
          updated_at = now()
      where id = ${id}::uuid
    `);
  }

  async scheduleRetry(input: {
    id: string;
    retryDelayMs: number;
    errorMessage: string;
  }): Promise<void> {
    const retryDelayMs = Math.max(0, Math.trunc(input.retryDelayMs));
    await this.prisma.$executeRaw(Prisma.sql`
      update public.domain_event_outbox
      set status = 'pending',
          attempts = attempts + 1,
          next_attempt_at = now() + (${retryDelayMs} * interval '1 millisecond'),
          last_error = left(${input.errorMessage}, 2000),
          updated_at = now()
      where id = ${input.id}::uuid
    `);
  }

  async markFailed(input: { id: string; errorMessage: string }): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      update public.domain_event_outbox
      set status = 'failed',
          attempts = attempts + 1,
          last_error = left(${input.errorMessage}, 2000),
          updated_at = now()
      where id = ${input.id}::uuid
    `);
  }
}

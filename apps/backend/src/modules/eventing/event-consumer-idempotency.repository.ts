import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class EventConsumerIdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(eventId: string, consumer: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      insert into public.processed_domain_events (
        event_id,
        consumer,
        status,
        created_at,
        updated_at
      ) values (
        ${eventId}::uuid,
        ${consumer},
        'processing',
        now(),
        now()
      )
      on conflict (event_id, consumer) do nothing
      returning id
    `);
    return rows.length > 0;
  }

  async markProcessed(eventId: string, consumer: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      update public.processed_domain_events
      set status = 'processed',
          processed_at = now(),
          updated_at = now()
      where event_id = ${eventId}::uuid
        and consumer = ${consumer}
    `);
  }

  async release(eventId: string, consumer: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      delete from public.processed_domain_events
      where event_id = ${eventId}::uuid
        and consumer = ${consumer}
        and status = 'processing'
    `);
  }
}

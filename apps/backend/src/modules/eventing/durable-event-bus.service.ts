import { Injectable } from '@nestjs/common';
import { DomainEventOutboxRepository } from './domain-event-outbox.repository';
import {
  createDomainEvent,
  DOMAIN_EVENT_VERSION,
  type PublishDomainEventInput,
} from './domain-events.contracts';

@Injectable()
export class DurableEventBusService {
  private readonly defaultMaxAttempts: number;

  constructor(private readonly outboxRepository: DomainEventOutboxRepository) {
    const parsed = Number.parseInt(String(process.env.BOTMOX_EVENT_OUTBOX_MAX_ATTEMPTS || ''), 10);
    this.defaultMaxAttempts = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  }

  async publish(input: PublishDomainEventInput): Promise<string> {
    const event = createDomainEvent({
      ...input,
      version: Number.isFinite(input.version) ? Number(input.version) : DOMAIN_EVENT_VERSION,
    });
    return this.outboxRepository.enqueue(event, this.defaultMaxAttempts);
  }
}

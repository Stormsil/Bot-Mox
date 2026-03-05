import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { type BotDeletedEvent, DOMAIN_EVENT_TYPES } from '../eventing/domain-events.contracts';
import { EventConsumerIdempotencyService } from '../eventing/event-consumer-idempotency.service';
import { ResourcesRepository } from './resources.repository';

@Injectable()
export class ResourcesLifecycleEventsHandler {
  constructor(
    private readonly repository: ResourcesRepository,
    private readonly idempotencyService: EventConsumerIdempotencyService,
  ) {}

  @OnEvent(DOMAIN_EVENT_TYPES.BOT_DELETED, { async: true })
  async handleBotDeleted(event: BotDeletedEvent): Promise<void> {
    await this.idempotencyService.runOnce({
      eventId: event.eventId,
      consumer: 'resources.bot-deleted.cleanup.v1',
      handler: async () => {
        await this.repository.deleteLinkedToBot(event.tenantId, event.payload.botId);
      },
    });
  }
}

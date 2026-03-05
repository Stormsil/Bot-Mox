import { Global, Module } from '@nestjs/common';
import { DomainEventOutboxRepository } from './domain-event-outbox.repository';
import { DurableEventBusService } from './durable-event-bus.service';
import { EventConsumerIdempotencyRepository } from './event-consumer-idempotency.repository';
import { EventConsumerIdempotencyService } from './event-consumer-idempotency.service';
import { OutboxRelayService } from './outbox-relay.service';

@Global()
@Module({
  providers: [
    DomainEventOutboxRepository,
    DurableEventBusService,
    OutboxRelayService,
    EventConsumerIdempotencyRepository,
    EventConsumerIdempotencyService,
  ],
  exports: [DurableEventBusService, EventConsumerIdempotencyService],
})
export class EventingModule {}

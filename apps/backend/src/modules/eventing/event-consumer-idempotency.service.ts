import { Injectable } from '@nestjs/common';
import { EventConsumerIdempotencyRepository } from './event-consumer-idempotency.repository';

@Injectable()
export class EventConsumerIdempotencyService {
  constructor(private readonly repository: EventConsumerIdempotencyRepository) {}

  async runOnce(input: {
    eventId: string;
    consumer: string;
    handler: () => Promise<void>;
  }): Promise<boolean> {
    const acquired = await this.repository.acquire(input.eventId, input.consumer);
    if (!acquired) {
      return false;
    }

    try {
      await input.handler();
      await this.repository.markProcessed(input.eventId, input.consumer);
      return true;
    } catch (error) {
      await this.repository.release(input.eventId, input.consumer);
      throw error;
    }
  }
}

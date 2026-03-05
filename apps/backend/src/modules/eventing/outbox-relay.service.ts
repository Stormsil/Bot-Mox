import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventOutboxRepository } from './domain-event-outbox.repository';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly batchSize: number;
  private readonly intervalMs: number;
  private readonly retryDelayMs: number;
  private readonly processingStaleAfterMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private readonly outboxRepository: DomainEventOutboxRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.batchSize = this.readInt('BOTMOX_EVENT_OUTBOX_BATCH_SIZE', 50);
    this.intervalMs = this.readInt('BOTMOX_EVENT_OUTBOX_RELAY_INTERVAL_MS', 1000);
    this.retryDelayMs = this.readInt('BOTMOX_EVENT_OUTBOX_RETRY_DELAY_MS', 1000);
    this.processingStaleAfterMs = this.readInt('BOTMOX_EVENT_OUTBOX_PROCESSING_STALE_MS', 30_000);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processDueEvents();
    }, this.intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private readInt(envName: string, fallback: number): number {
    const parsed = Number.parseInt(String(process.env[envName] || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.trunc(parsed);
  }

  async processDueEvents(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      const batch = await this.outboxRepository.claimRelayBatch({
        limit: this.batchSize,
        processingStaleAfterMs: this.processingStaleAfterMs,
      });
      for (const row of batch) {
        try {
          await this.eventEmitter.emitAsync(row.eventType, row.payload);
          await this.outboxRepository.markPublished(row.id);
        } catch (error) {
          const errorMessage = (error as Error)?.message || String(error);
          if (row.attempts + 1 >= row.maxAttempts) {
            await this.outboxRepository.markFailed({
              id: row.id,
              errorMessage,
            });
            this.logger.error(
              `Outbox event failed permanently: id=${row.id}, type=${row.eventType}`,
            );
          } else {
            await this.outboxRepository.scheduleRetry({
              id: row.id,
              retryDelayMs: this.retryDelayMs,
              errorMessage,
            });
          }
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}

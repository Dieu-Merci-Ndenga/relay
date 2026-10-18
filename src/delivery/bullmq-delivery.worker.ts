import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DeliveryJob } from './delivery-queue';
import type { EventStore } from '../events/event-store';

const QUEUE_NAME = 'relay-deliveries';

@Injectable()
export class BullMqDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    { maxRetriesPerRequest: null },
  );
  private worker?: Worker<DeliveryJob>;

  constructor(private readonly eventStore: EventStore) {}

  onModuleInit(): void {
    const deliveryUrl = process.env.DELIVERY_URL;

    if (!deliveryUrl) {
      return;
    }

    this.worker = new Worker<DeliveryJob>(
      QUEUE_NAME,
      async (job) => {
        const startedAt = Date.now();
        const attemptNumber = job.attemptsMade + 1;

        try {
          const response = await fetch(deliveryUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-relay-event-id': job.data.eventId,
              'x-relay-source': job.data.source,
            },
            body: JSON.stringify(job.data.payload),
          });

          if (!response.ok) {
            throw new Error(`Delivery failed with HTTP ${response.status}`);
          }

          await this.eventStore.recordAttempt({
            eventId: job.data.eventId,
            attemptNumber,
            status: 'delivered',
            httpStatus: response.status,
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await this.eventStore.recordAttempt({
            eventId: job.data.eventId,
            attemptNumber,
            status: 'failed',
            error: reason,
            durationMs: Date.now() - startedAt,
          });

          if (attemptNumber >= (job.opts.attempts ?? 1)) {
            await this.eventStore.markDeadLetter({
              eventId: job.data.eventId,
              reason,
            });
          }

          throw error;
        }
      },
      { connection: this.connection, concurrency: 10 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection.quit();
  }
}
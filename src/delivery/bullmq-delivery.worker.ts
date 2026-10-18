import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DeliveryJob } from './delivery-queue';

const QUEUE_NAME = 'relay-deliveries';

@Injectable()
export class BullMqDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    { maxRetriesPerRequest: null },
  );
  private worker?: Worker<DeliveryJob>;

  onModuleInit(): void {
    const deliveryUrl = process.env.DELIVERY_URL;

    if (!deliveryUrl) {
      return;
    }

    this.worker = new Worker<DeliveryJob>(
      QUEUE_NAME,
      async (job) => {
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
      },
      { connection: this.connection, concurrency: 10 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection.quit();
  }
}
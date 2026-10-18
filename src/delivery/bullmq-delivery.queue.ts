import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { DeliveryJob, DeliveryQueue } from './delivery-queue';

const QUEUE_NAME = 'relay-deliveries';

@Injectable()
export class BullMqDeliveryQueue implements DeliveryQueue, OnModuleDestroy {
  private readonly connection = new IORedis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    { maxRetriesPerRequest: null },
  );
  private readonly queue = new Queue<DeliveryJob>(QUEUE_NAME, {
    connection: this.connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: false,
    },
  });

  async enqueue(job: DeliveryJob): Promise<void> {
    await this.queue.add(`event:${job.eventId}`, job, {
      jobId: job.eventId,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
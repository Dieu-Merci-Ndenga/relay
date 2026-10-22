import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { DeliveryJob, DeliveryQueue, deliveryJobId } from './delivery-queue';

export const QUEUE_NAME = 'relay-deliveries';
export const RETRY_QUEUE_NAME = 'relay-retries';

@Injectable()
export class BullMqDeliveryQueue implements DeliveryQueue, OnModuleDestroy {
  private readonly connection = new IORedis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    { maxRetriesPerRequest: null },
  );
  // Retries are not handled by BullMQ's own attempts: the worker schedules
  // them on a separate queue, so late retries never delay new events.
  private readonly queue = new Queue<DeliveryJob>(QUEUE_NAME, {
    connection: this.connection,
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: false,
    },
  });

  async enqueue(job: DeliveryJob, jobId?: string): Promise<void> {
    await this.queue.add(`event:${job.eventId}`, job, {
      jobId: jobId ?? deliveryJobId(job.source, job.eventId),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}

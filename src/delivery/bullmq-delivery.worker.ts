import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DeliveryJob } from './delivery-queue';
import { QUEUE_NAME, RETRY_QUEUE_NAME } from './bullmq-delivery.queue';
import { DeliveryProcessor, RetryScheduler } from './delivery-processor';
import type { EventStore } from '../events/event-store';
import { deliverySecret } from '../config/secrets';
import { MetricsService } from '../metrics/metrics.service';

const intFromEnv = (name: string, fallback: number): number => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

@Injectable()
export class BullMqDeliveryWorker
  implements OnModuleInit, OnModuleDestroy, RetryScheduler
{
  private readonly connection = new IORedis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    { maxRetriesPerRequest: null },
  );
  private readonly retryQueue = new Queue<DeliveryJob>(RETRY_QUEUE_NAME, {
    connection: this.connection,
    defaultJobOptions: { removeOnComplete: 1000, removeOnFail: false },
  });
  private workers: Worker<DeliveryJob>[] = [];

  constructor(
    private readonly eventStore: EventStore,
    private readonly metrics: MetricsService,
  ) {}

  async scheduleRetry(
    job: DeliveryJob,
    jobId: string,
    delayMs: number,
  ): Promise<void> {
    await this.retryQueue.add(`event:${job.eventId}`, job, {
      jobId,
      delay: delayMs,
    });
  }

  onModuleInit(): void {
    const url = process.env.DELIVERY_URL;

    if (!url) {
      return;
    }

    const processor = new DeliveryProcessor(
      this.eventStore,
      this,
      this.metrics,
      {
        url,
        secret: deliverySecret(),
        maxAttempts: intFromEnv('DELIVERY_MAX_ATTEMPTS', 5),
        backoffBaseMs: intFromEnv('DELIVERY_BACKOFF_MS', 1000),
        timeoutMs: intFromEnv('DELIVERY_TIMEOUT_MS', 10_000),
      },
    );
    const handle = (job: Job<DeliveryJob>) =>
      processor.process(job.data, {
        jobId: job.id ?? '',
        queueLagMs:
          (job.processedOn ?? Date.now()) -
          (job.timestamp + (job.opts.delay ?? 0)),
      });

    this.workers = [
      new Worker<DeliveryJob>(QUEUE_NAME, handle, {
        connection: this.connection,
        concurrency: intFromEnv('DELIVERY_CONCURRENCY', 10),
      }),
      new Worker<DeliveryJob>(RETRY_QUEUE_NAME, handle, {
        connection: this.connection,
        concurrency: intFromEnv('RETRY_CONCURRENCY', 5),
      }),
    ];
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await this.retryQueue.close();
    await this.connection.quit();
  }
}

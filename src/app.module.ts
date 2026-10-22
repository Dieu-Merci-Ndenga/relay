import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EVENT_STORE } from './events/event-store';
import { InMemoryEventStore } from './events/in-memory-event.store';
import { PostgresEventStore } from './events/postgres-event.store';
import { DELIVERY_QUEUE, DELIVERY_WORKER } from './delivery/delivery-queue';
import { InMemoryDeliveryQueue } from './delivery/in-memory-delivery.queue';
import { BullMqDeliveryQueue } from './delivery/bullmq-delivery.queue';
import { BullMqDeliveryWorker } from './delivery/bullmq-delivery.worker';
import { OutboxSweeper } from './delivery/outbox-sweeper';
import { MetricsService } from './metrics/metrics.service';
import type { DeliveryQueue } from './delivery/delivery-queue';
import type { EventStore } from './events/event-store';

export const OUTBOX_SWEEPER = Symbol('OUTBOX_SWEEPER');

const nonNegativeIntFromEnv = (name: string, fallback: number): number => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    MetricsService,
    {
      provide: EVENT_STORE,
      useFactory: () =>
        process.env.NODE_ENV === 'test'
          ? new InMemoryEventStore()
          : new PostgresEventStore(),
    },
    {
      provide: DELIVERY_QUEUE,
      useFactory: () =>
        process.env.NODE_ENV === 'test'
          ? new InMemoryDeliveryQueue()
          : new BullMqDeliveryQueue(),
    },
    {
      provide: DELIVERY_WORKER,
      useFactory: (eventStore: EventStore, metrics: MetricsService) =>
        process.env.NODE_ENV === 'test'
          ? null
          : new BullMqDeliveryWorker(eventStore, metrics),
      inject: [EVENT_STORE, MetricsService],
    },
    {
      provide: OUTBOX_SWEEPER,
      useFactory: (
        eventStore: EventStore,
        deliveryQueue: DeliveryQueue,
        metrics: MetricsService,
      ) =>
        new OutboxSweeper(eventStore, deliveryQueue, metrics, {
          intervalMs:
            process.env.NODE_ENV === 'test'
              ? 0
              : nonNegativeIntFromEnv('OUTBOX_SWEEP_INTERVAL_MS', 30_000),
          graceMs: nonNegativeIntFromEnv('OUTBOX_GRACE_MS', 60_000),
          batchSize: nonNegativeIntFromEnv('OUTBOX_BATCH_SIZE', 100) || 100,
        }),
      inject: [EVENT_STORE, DELIVERY_QUEUE, MetricsService],
    },
  ],
})
export class AppModule {}

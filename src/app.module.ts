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

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
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
      useFactory: () =>
        process.env.NODE_ENV === 'test' ? null : new BullMqDeliveryWorker(),
    },
  ],
})
export class AppModule {}

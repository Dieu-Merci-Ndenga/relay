import { createHmac } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EVENT_STORE } from './events/event-store';
import { InMemoryEventStore } from './events/in-memory-event.store';
import { DELIVERY_QUEUE } from './delivery/delivery-queue';
import { InMemoryDeliveryQueue } from './delivery/in-memory-delivery.queue';

describe('AppController', () => {
  let appController: AppController;
  let deliveryQueue: InMemoryDeliveryQueue;
  let eventStore: InMemoryEventStore;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: EVENT_STORE, useClass: InMemoryEventStore },
        { provide: DELIVERY_QUEUE, useClass: InMemoryDeliveryQueue },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    deliveryQueue = app.get<InMemoryDeliveryQueue>(DELIVERY_QUEUE);
    eventStore = app.get<InMemoryEventStore>(EVENT_STORE);
  });

  describe('webhooks', () => {
    const payload = { amount: 4200, currency: 'EUR' };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', 'dev-secret')
      .update(rawBody)
      .digest('hex');

    it('accepts a signed event and reports duplicates', async () => {
      const request = { rawBody, body: payload } as never;

      await expect(
        appController.receiveWebhook('stripe', 'evt_123', signature, request),
      ).resolves.toMatchObject({ accepted: true, duplicate: false });
      await expect(
        appController.receiveWebhook('stripe', 'evt_123', signature, request),
      ).resolves.toMatchObject({ accepted: true, duplicate: true });
      expect(deliveryQueue.jobs).toHaveLength(1);
    });

    it('rejects an invalid signature', async () => {
      const request = { rawBody, body: payload } as never;

      await expect(
        appController.receiveWebhook('stripe', 'evt_456', 'invalid', request),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('exposes attempts and dead letters', async () => {
      await eventStore.recordAttempt({
        eventId: 'evt_failed',
        attemptNumber: 5,
        status: 'failed',
        httpStatus: 503,
        error: 'receiver unavailable',
        durationMs: 42,
      });
      await eventStore.markDeadLetter({
        eventId: 'evt_failed',
        reason: 'receiver unavailable',
      });

      await expect(appController.getAttempts('evt_failed')).resolves.toEqual([
        expect.objectContaining({ attemptNumber: 5, httpStatus: 503 }),
      ]);
      await expect(appController.getDeadLetters()).resolves.toEqual([
        { eventId: 'evt_failed', reason: 'receiver unavailable' },
      ]);
    });

    it('queues a manual retry for a dead-letter event', async () => {
      await eventStore.saveIfNew({
        eventId: 'evt_retry',
        source: 'stripe',
        payload: { event: 'payment.created' },
      });
      await eventStore.markDeadLetter({
        eventId: 'evt_retry',
        reason: 'receiver unavailable',
      });

      await expect(appController.retryEvent('evt_retry')).resolves.toEqual({
        eventId: 'evt_retry',
        status: 'queued_for_retry',
      });
      expect(deliveryQueue.jobs).toHaveLength(1);
      expect(deliveryQueue.jobs[0]).toMatchObject({ eventId: 'evt_retry' });
    });
  });
});

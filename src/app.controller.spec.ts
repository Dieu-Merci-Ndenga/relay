import { createHmac } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EVENT_STORE } from './events/event-store';
import { InMemoryEventStore } from './events/in-memory-event.store';
import { DELIVERY_QUEUE } from './delivery/delivery-queue';
import { InMemoryDeliveryQueue } from './delivery/in-memory-delivery.queue';
import { MetricsService } from './metrics/metrics.service';

describe('AppController', () => {
  let appController: AppController;
  let deliveryQueue: InMemoryDeliveryQueue;
  let eventStore: InMemoryEventStore;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        MetricsService,
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
      const enqueue = jest.spyOn(deliveryQueue, 'enqueue');

      await expect(
        appController.receiveWebhook('stripe', 'evt_123', signature, request),
      ).resolves.toMatchObject({ accepted: true, duplicate: false });
      await expect(
        appController.receiveWebhook('stripe', 'evt_123', signature, request),
      ).resolves.toMatchObject({ accepted: true, duplicate: true });
      expect(enqueue).toHaveBeenCalledTimes(2);
      expect(deliveryQueue.jobs).toHaveLength(1);
    });

    it('retries queue insertion after a transient failure', async () => {
      const request = { rawBody, body: payload } as never;
      const enqueue = jest
        .spyOn(deliveryQueue, 'enqueue')
        .mockRejectedValueOnce(new Error('Redis unavailable'));

      await expect(
        appController.receiveWebhook(
          'stripe',
          'evt_retry_enqueue',
          signature,
          request,
        ),
      ).rejects.toThrow('Redis unavailable');
      await expect(
        appController.receiveWebhook(
          'stripe',
          'evt_retry_enqueue',
          signature,
          request,
        ),
      ).resolves.toMatchObject({ accepted: true, duplicate: true });

      expect(enqueue).toHaveBeenCalledTimes(2);
      expect(deliveryQueue.jobs).toHaveLength(1);
    });

    it('does not requeue an event that has already been delivered', async () => {
      const request = { rawBody, body: payload } as never;
      await eventStore.saveIfNew({
        eventId: 'evt_delivered',
        source: 'stripe',
        payload,
      });
      await eventStore.recordAttempt({
        source: 'stripe',
        eventId: 'evt_delivered',
        attemptNumber: 1,
        status: 'delivered',
        httpStatus: 200,
        durationMs: 42,
      });

      await expect(
        appController.receiveWebhook(
          'stripe',
          'evt_delivered',
          signature,
          request,
        ),
      ).resolves.toMatchObject({ accepted: true, duplicate: true });
      expect(deliveryQueue.jobs).toHaveLength(0);
    });

    it('rejects an invalid signature', async () => {
      const request = { rawBody, body: payload } as never;

      await expect(
        appController.receiveWebhook('stripe', 'evt_456', 'invalid', request),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('exposes attempts and dead letters', async () => {
      await eventStore.recordAttempt({
        source: 'stripe',
        eventId: 'evt_failed',
        attemptNumber: 5,
        status: 'failed',
        httpStatus: 503,
        error: 'receiver unavailable',
        durationMs: 42,
      });
      await eventStore.markDeadLetter({
        source: 'stripe',
        eventId: 'evt_failed',
        reason: 'receiver unavailable',
      });

      await expect(
        appController.getAttempts('stripe', 'evt_failed'),
      ).resolves.toEqual([
        expect.objectContaining({ attemptNumber: 5, httpStatus: 503 }),
      ]);
      await expect(appController.getDeadLetters()).resolves.toEqual([
        {
          source: 'stripe',
          eventId: 'evt_failed',
          reason: 'receiver unavailable',
        },
      ]);
    });

    it('queues a manual retry for a dead-letter event', async () => {
      await eventStore.saveIfNew({
        eventId: 'evt_retry',
        source: 'stripe',
        payload: { event: 'payment.created' },
      });
      await eventStore.markDeadLetter({
        source: 'stripe',
        eventId: 'evt_retry',
        reason: 'receiver unavailable',
      });

      await expect(
        appController.retryEvent('stripe', 'evt_retry'),
      ).resolves.toEqual({
        source: 'stripe',
        eventId: 'evt_retry',
        status: 'queued_for_retry',
      });
      expect(deliveryQueue.jobs).toHaveLength(1);
      expect(deliveryQueue.jobs[0]).toMatchObject({ eventId: 'evt_retry' });
    });

    it('keeps events with the same id from different sources apart', async () => {
      const request = { rawBody, body: payload } as never;

      await expect(
        appController.receiveWebhook('stripe', 'evt_same', signature, request),
      ).resolves.toMatchObject({ duplicate: false });
      await expect(
        appController.receiveWebhook('github', 'evt_same', signature, request),
      ).resolves.toMatchObject({ duplicate: false });

      expect(deliveryQueue.jobs.map((job) => job.source)).toEqual([
        'stripe',
        'github',
      ]);
    });

    it('resolves legacy routes only when the event id is unambiguous', async () => {
      const request = { rawBody, body: payload } as never;
      await appController.receiveWebhook(
        'stripe',
        'evt_legacy',
        signature,
        request,
      );
      await eventStore.markDeadLetter({
        source: 'stripe',
        eventId: 'evt_legacy',
        reason: 'boom',
      });

      await expect(
        appController.getAttemptsByEventId('evt_unknown'),
      ).resolves.toEqual([]);
      await expect(
        appController.retryEventByEventId('evt_legacy'),
      ).resolves.toMatchObject({
        source: 'stripe',
        status: 'queued_for_retry',
      });

      await appController.receiveWebhook(
        'github',
        'evt_legacy',
        signature,
        request,
      );
      await expect(
        appController.retryEventByEventId('evt_legacy'),
      ).rejects.toThrow(ConflictException);
    });

    it('serves metrics and enforces the optional token', async () => {
      const response = { type: jest.fn() } as never;
      const request = { rawBody, body: payload } as never;
      await appController.receiveWebhook(
        'stripe',
        'evt_metrics',
        signature,
        request,
      );

      await expect(
        appController.getMetrics(undefined, response),
      ).resolves.toContain(
        'relay_events_received_total{source="stripe",result="new"} 1',
      );

      process.env.METRICS_TOKEN = 's3cret';
      try {
        await expect(
          appController.getMetrics('Bearer wrong', response),
        ).rejects.toThrow(UnauthorizedException);
        await expect(
          appController.getMetrics('Bearer s3cret', response),
        ).resolves.toContain('relay_outbox_pending_events');
      } finally {
        delete process.env.METRICS_TOKEN;
      }
    });
  });
});

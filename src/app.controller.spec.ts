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
  });
});

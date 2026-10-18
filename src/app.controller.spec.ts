import { createHmac } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('webhooks', () => {
    const payload = { amount: 4200, currency: 'EUR' };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', 'dev-secret')
      .update(rawBody)
      .digest('hex');

    it('accepts a signed event and reports duplicates', () => {
      const request = { rawBody, body: payload } as never;

      expect(
        appController.receiveWebhook('stripe', 'evt_123', signature, request),
      ).toMatchObject({ accepted: true, duplicate: false });
      expect(
        appController.receiveWebhook('stripe', 'evt_123', signature, request),
      ).toMatchObject({ accepted: true, duplicate: true });
    });

    it('rejects an invalid signature', () => {
      const request = { rawBody, body: payload } as never;

      expect(() =>
        appController.receiveWebhook('stripe', 'evt_456', 'invalid', request),
      ).toThrow(UnauthorizedException);
    });
  });
});

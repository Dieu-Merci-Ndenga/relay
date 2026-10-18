import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHmac } from 'node:crypto';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  it('accepts a signed webhook and is idempotent', async () => {
    const payload = { event: 'payment.created' };
    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', 'dev-secret')
      .update(rawBody)
      .digest('hex');

    return request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('x-relay-event-id', 'evt_e2e')
      .set('x-relay-signature', signature)
      .set('content-type', 'application/json')
      .send(payload)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({ accepted: true, duplicate: false });
      })
      .then(() =>
        request(app.getHttpServer())
          .post('/webhooks/stripe')
          .set('x-relay-event-id', 'evt_e2e')
          .set('x-relay-signature', signature)
          .set('content-type', 'application/json')
          .send(payload)
          .expect(201)
          .expect(({ body }) => {
            expect(body).toMatchObject({ accepted: true, duplicate: true });
          }),
      );
  });

  it('reports a healthy application', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  afterEach(async () => {
    await app.close();
  });
});

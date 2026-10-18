import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_STORE, WebhookEvent } from './events/event-store';
import type { EventStore } from './events/event-store';
import { DELIVERY_QUEUE } from './delivery/delivery-queue';
import type { DeliveryQueue } from './delivery/delivery-queue';

@Injectable()
export class AppService {
  private readonly secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';

  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: EventStore,
    @Inject(DELIVERY_QUEUE) private readonly deliveryQueue: DeliveryQueue,
  ) {}

  verifySignature(rawBody: Buffer | undefined, signature: string): boolean {
    if (!rawBody) {
      return false;
    }

    const expected = createHmac('sha256', this.secret)
      .update(rawBody)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }

  async acceptEvent(event: WebhookEvent) {
    const duplicate = !(await this.eventStore.saveIfNew(event));

    if (!duplicate) {
      await this.deliveryQueue.enqueue(event);
    }

    return {
      accepted: true,
      duplicate,
      eventId: event.eventId,
      status: duplicate ? 'already_received' : 'received',
    };
  }

  getAttempts(eventId: string) {
    return this.eventStore.getAttempts(eventId);
  }

  listDeadLetters() {
    return this.eventStore.listDeadLetters();
  }
}

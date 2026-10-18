import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

  async retryEvent(eventId: string) {
    const event = await this.eventStore.getEvent(eventId);
    const deadLetter = await this.eventStore.getDeadLetter(eventId);

    if (!event || !deadLetter) {
      throw new NotFoundException('Event is not in the dead-letter queue');
    }

    await this.deliveryQueue.enqueue(event, `manual-retry:${eventId}:${Date.now()}`);

    return {
      eventId,
      status: 'queued_for_retry',
    };
  }

  getAttempts(eventId: string) {
    return this.eventStore.getAttempts(eventId);
  }

  listDeadLetters() {
    return this.eventStore.listDeadLetters();
  }
}

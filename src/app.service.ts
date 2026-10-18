import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

type WebhookEvent = {
  eventId: string;
  source: string;
  payload: unknown;
};

@Injectable()
export class AppService {
  private readonly events = new Map<string, WebhookEvent>();
  private readonly secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';

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

  acceptEvent(event: WebhookEvent) {
    const duplicate = this.events.has(event.eventId);

    if (!duplicate) {
      this.events.set(event.eventId, event);
    }

    return {
      accepted: true,
      duplicate,
      eventId: event.eventId,
      status: duplicate ? 'already_received' : 'received',
    };
  }
}

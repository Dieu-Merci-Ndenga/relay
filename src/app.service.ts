import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EVENT_STORE, EventKey, WebhookEvent } from './events/event-store';
import type { EventStore } from './events/event-store';
import { DELIVERY_QUEUE, manualRetryJobId } from './delivery/delivery-queue';
import type { DeliveryQueue } from './delivery/delivery-queue';
import { MetricsService } from './metrics/metrics.service';
import { isValidSignature } from './signature';
import { webhookSecret } from './config/secrets';

@Injectable()
export class AppService {
  private readonly secret = webhookSecret();

  constructor(
    @Inject(EVENT_STORE) private readonly eventStore: EventStore,
    @Inject(DELIVERY_QUEUE) private readonly deliveryQueue: DeliveryQueue,
    private readonly metrics: MetricsService,
  ) {}

  verifySignature(rawBody: Buffer | undefined, signature: string): boolean {
    if (!rawBody) {
      return false;
    }

    return isValidSignature(rawBody, signature, this.secret);
  }

  async acceptEvent(event: WebhookEvent) {
    const isNew = await this.eventStore.saveIfNew(event);

    // A duplicate may mean an earlier request stored the event but failed to
    // enqueue it, so enqueueing is retried unless delivery already succeeded.
    // The queue deduplicates by job id, which keeps this safe to repeat.
    if (isNew || !(await this.eventStore.hasSuccessfulDelivery(event))) {
      await this.deliveryQueue.enqueue(event);
      await this.eventStore.markEnqueued(event);
    }

    this.metrics.recordEvent(event.source, isNew ? 'new' : 'duplicate');

    return {
      accepted: true,
      duplicate: !isNew,
      eventId: event.eventId,
      status: isNew ? 'received' : 'already_received',
    };
  }

  async retryEvent(key: EventKey) {
    const event = await this.eventStore.getEvent(key);
    const deadLetter = await this.eventStore.getDeadLetter(key);

    if (!event || !deadLetter) {
      throw new NotFoundException('Event is not in the dead-letter queue');
    }

    await this.deliveryQueue.enqueue(
      event,
      manualRetryJobId(key.source, key.eventId, Date.now()),
    );

    return {
      source: key.source,
      eventId: key.eventId,
      status: 'queued_for_retry',
    };
  }

  getAttempts(key: EventKey) {
    return this.eventStore.getAttempts(key);
  }

  // Legacy route without a source: unknown events still yield no attempts.
  async getAttemptsByEventId(eventId: string) {
    const sources = await this.eventStore.findSources(eventId);

    return sources.length === 0
      ? []
      : this.getAttempts(await this.resolveKey(eventId));
  }

  listDeadLetters() {
    return this.eventStore.listDeadLetters();
  }

  // Resolves an event id given without a source, for the legacy routes.
  async resolveKey(eventId: string): Promise<EventKey> {
    const sources = await this.eventStore.findSources(eventId);

    if (sources.length === 0) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    if (sources.length > 1) {
      throw new ConflictException(
        `Event id ${eventId} exists for several sources (${sources.join(', ')}); use /events/:source/:eventId`,
      );
    }

    return { source: sources[0], eventId };
  }
}

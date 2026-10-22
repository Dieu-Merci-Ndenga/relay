import { Injectable } from '@nestjs/common';
import {
  DeadLetter,
  DeliveryAttempt,
  EventKey,
  EventStore,
  WebhookEvent,
} from './event-store';

type StoredEvent = WebhookEvent & {
  receivedAt: number;
  enqueuedAt?: number;
};

const keyOf = ({ source, eventId }: EventKey) =>
  JSON.stringify([source, eventId]);

@Injectable()
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, StoredEvent>();
  readonly attempts: DeliveryAttempt[] = [];
  readonly deadLetters: DeadLetter[] = [];

  async saveIfNew(event: WebhookEvent): Promise<boolean> {
    const key = keyOf(event);
    if (this.events.has(key)) {
      return false;
    }

    this.events.set(key, { ...event, receivedAt: Date.now() });
    return true;
  }

  async getEvent(key: EventKey): Promise<WebhookEvent | undefined> {
    const stored = this.events.get(keyOf(key));
    return stored
      ? {
          eventId: stored.eventId,
          source: stored.source,
          payload: stored.payload,
        }
      : undefined;
  }

  async findSources(eventId: string): Promise<string[]> {
    return [...this.events.values()]
      .filter((event) => event.eventId === eventId)
      .map((event) => event.source);
  }

  async hasSuccessfulDelivery(key: EventKey): Promise<boolean> {
    return this.attempts.some(
      (attempt) =>
        keyOf(attempt) === keyOf(key) && attempt.status === 'delivered',
    );
  }

  async markEnqueued(key: EventKey): Promise<void> {
    const stored = this.events.get(keyOf(key));
    if (stored) {
      stored.enqueuedAt ??= Date.now();
    }
  }

  async listPendingEnqueue(
    olderThanMs: number,
    limit: number,
  ): Promise<WebhookEvent[]> {
    const cutoff = Date.now() - olderThanMs;
    return [...this.events.values()]
      .filter((event) => !event.enqueuedAt && event.receivedAt <= cutoff)
      .sort((a, b) => a.receivedAt - b.receivedAt)
      .slice(0, limit)
      .map(({ eventId, source, payload }) => ({ eventId, source, payload }));
  }

  async countPendingEnqueue(): Promise<number> {
    return [...this.events.values()].filter((event) => !event.enqueuedAt)
      .length;
  }

  async recordAttempt(attempt: DeliveryAttempt): Promise<void> {
    this.attempts.push({
      ...attempt,
      createdAt: attempt.createdAt ?? new Date().toISOString(),
    });
  }

  async markDeadLetter(deadLetter: DeadLetter): Promise<void> {
    const existingIndex = this.deadLetters.findIndex(
      (item) => keyOf(item) === keyOf(deadLetter),
    );
    if (existingIndex >= 0) {
      this.deadLetters[existingIndex] = deadLetter;
      return;
    }
    this.deadLetters.push(deadLetter);
  }

  async getDeadLetter(key: EventKey): Promise<DeadLetter | undefined> {
    return this.deadLetters.find((item) => keyOf(item) === keyOf(key));
  }

  async clearDeadLetter(key: EventKey): Promise<void> {
    const index = this.deadLetters.findIndex(
      (item) => keyOf(item) === keyOf(key),
    );
    if (index >= 0) {
      this.deadLetters.splice(index, 1);
    }
  }

  async getAttempts(key: EventKey): Promise<DeliveryAttempt[]> {
    return this.attempts.filter((attempt) => keyOf(attempt) === keyOf(key));
  }

  async listDeadLetters(): Promise<DeadLetter[]> {
    return this.deadLetters;
  }
}

import { Injectable } from '@nestjs/common';
import {
  DeadLetter,
  DeliveryAttempt,
  EventStore,
  WebhookEvent,
} from './event-store';

@Injectable()
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, WebhookEvent>();
  readonly attempts: DeliveryAttempt[] = [];
  readonly deadLetters: DeadLetter[] = [];

  async saveIfNew(event: WebhookEvent): Promise<boolean> {
    if (this.events.has(event.eventId)) {
      return false;
    }

    this.events.set(event.eventId, event);
    return true;
  }

  async getEvent(eventId: string): Promise<WebhookEvent | undefined> {
    return this.events.get(eventId);
  }

  async recordAttempt(attempt: DeliveryAttempt): Promise<void> {
    this.attempts.push({
      ...attempt,
      createdAt: attempt.createdAt ?? new Date().toISOString(),
    });
  }

  async markDeadLetter(deadLetter: DeadLetter): Promise<void> {
    const existingIndex = this.deadLetters.findIndex(
      (item) => item.eventId === deadLetter.eventId,
    );
    if (existingIndex >= 0) {
      this.deadLetters[existingIndex] = deadLetter;
      return;
    }
    this.deadLetters.push(deadLetter);
  }

  async getDeadLetter(eventId: string): Promise<DeadLetter | undefined> {
    return this.deadLetters.find((item) => item.eventId === eventId);
  }

  async clearDeadLetter(eventId: string): Promise<void> {
    const index = this.deadLetters.findIndex((item) => item.eventId === eventId);
    if (index >= 0) {
      this.deadLetters.splice(index, 1);
    }
  }

  async getAttempts(eventId: string): Promise<DeliveryAttempt[]> {
    return this.attempts.filter((attempt) => attempt.eventId === eventId);
  }

  async listDeadLetters(): Promise<DeadLetter[]> {
    return this.deadLetters;
  }
}
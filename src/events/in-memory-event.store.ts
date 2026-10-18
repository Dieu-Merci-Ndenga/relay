import { Injectable } from '@nestjs/common';
import {
  DeadLetter,
  DeliveryAttempt,
  EventStore,
  WebhookEvent,
} from './event-store';

@Injectable()
export class InMemoryEventStore implements EventStore {
  private readonly events = new Set<string>();
  readonly attempts: DeliveryAttempt[] = [];
  readonly deadLetters: DeadLetter[] = [];

  async saveIfNew(event: WebhookEvent): Promise<boolean> {
    if (this.events.has(event.eventId)) {
      return false;
    }

    this.events.add(event.eventId);
    return true;
  }

  async recordAttempt(attempt: DeliveryAttempt): Promise<void> {
    this.attempts.push(attempt);
  }

  async markDeadLetter(deadLetter: DeadLetter): Promise<void> {
    this.deadLetters.push(deadLetter);
  }

  async getAttempts(eventId: string): Promise<DeliveryAttempt[]> {
    return this.attempts.filter((attempt) => attempt.eventId === eventId);
  }

  async listDeadLetters(): Promise<DeadLetter[]> {
    return this.deadLetters;
  }
}
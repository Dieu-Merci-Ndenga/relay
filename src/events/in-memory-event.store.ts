import { Injectable } from '@nestjs/common';
import { EventStore, WebhookEvent } from './event-store';

@Injectable()
export class InMemoryEventStore implements EventStore {
  private readonly events = new Set<string>();

  async saveIfNew(event: WebhookEvent): Promise<boolean> {
    if (this.events.has(event.eventId)) {
      return false;
    }

    this.events.add(event.eventId);
    return true;
  }
}
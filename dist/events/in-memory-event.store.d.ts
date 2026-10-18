import { EventStore, WebhookEvent } from './event-store';
export declare class InMemoryEventStore implements EventStore {
    private readonly events;
    saveIfNew(event: WebhookEvent): Promise<boolean>;
}

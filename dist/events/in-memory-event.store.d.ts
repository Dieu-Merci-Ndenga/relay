import { DeadLetter, DeliveryAttempt, EventKey, EventStore, WebhookEvent } from './event-store';
export declare class InMemoryEventStore implements EventStore {
    private readonly events;
    readonly attempts: DeliveryAttempt[];
    readonly deadLetters: DeadLetter[];
    saveIfNew(event: WebhookEvent): Promise<boolean>;
    getEvent(key: EventKey): Promise<WebhookEvent | undefined>;
    findSources(eventId: string): Promise<string[]>;
    hasSuccessfulDelivery(key: EventKey): Promise<boolean>;
    markEnqueued(key: EventKey): Promise<void>;
    listPendingEnqueue(olderThanMs: number, limit: number): Promise<WebhookEvent[]>;
    countPendingEnqueue(): Promise<number>;
    recordAttempt(attempt: DeliveryAttempt): Promise<void>;
    markDeadLetter(deadLetter: DeadLetter): Promise<void>;
    getDeadLetter(key: EventKey): Promise<DeadLetter | undefined>;
    clearDeadLetter(key: EventKey): Promise<void>;
    getAttempts(key: EventKey): Promise<DeliveryAttempt[]>;
    listDeadLetters(): Promise<DeadLetter[]>;
}

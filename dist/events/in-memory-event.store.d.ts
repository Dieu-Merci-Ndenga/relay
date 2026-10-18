import { DeadLetter, DeliveryAttempt, EventStore, WebhookEvent } from './event-store';
export declare class InMemoryEventStore implements EventStore {
    private readonly events;
    readonly attempts: DeliveryAttempt[];
    readonly deadLetters: DeadLetter[];
    saveIfNew(event: WebhookEvent): Promise<boolean>;
    getEvent(eventId: string): Promise<WebhookEvent | undefined>;
    recordAttempt(attempt: DeliveryAttempt): Promise<void>;
    markDeadLetter(deadLetter: DeadLetter): Promise<void>;
    getDeadLetter(eventId: string): Promise<DeadLetter | undefined>;
    clearDeadLetter(eventId: string): Promise<void>;
    getAttempts(eventId: string): Promise<DeliveryAttempt[]>;
    listDeadLetters(): Promise<DeadLetter[]>;
}

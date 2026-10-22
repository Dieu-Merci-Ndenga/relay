import { OnModuleDestroy } from '@nestjs/common';
import { DeadLetter, DeliveryAttempt, EventKey, EventStore, WebhookEvent } from './event-store';
export declare class PostgresEventStore implements EventStore, OnModuleDestroy {
    private readonly pool;
    private schemaReady?;
    saveIfNew(event: WebhookEvent): Promise<boolean>;
    findSources(eventId: string): Promise<string[]>;
    hasSuccessfulDelivery(key: EventKey): Promise<boolean>;
    markEnqueued(key: EventKey): Promise<void>;
    listPendingEnqueue(olderThanMs: number, limit: number): Promise<WebhookEvent[]>;
    countPendingEnqueue(): Promise<number>;
    recordAttempt(attempt: DeliveryAttempt): Promise<void>;
    getEvent(key: EventKey): Promise<WebhookEvent | undefined>;
    markDeadLetter(deadLetter: DeadLetter): Promise<void>;
    getDeadLetter(key: EventKey): Promise<DeadLetter | undefined>;
    clearDeadLetter(key: EventKey): Promise<void>;
    getAttempts(key: EventKey): Promise<DeliveryAttempt[]>;
    listDeadLetters(): Promise<DeadLetter[]>;
    onModuleDestroy(): Promise<void>;
    private ensureSchema;
    private migrateSchema;
}

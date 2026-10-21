import { OnModuleDestroy } from '@nestjs/common';
import { DeadLetter, DeliveryAttempt, EventStore, WebhookEvent } from './event-store';
export declare class PostgresEventStore implements EventStore, OnModuleDestroy {
    private readonly pool;
    private schemaReady?;
    saveIfNew(event: WebhookEvent): Promise<boolean>;
    recordAttempt(attempt: DeliveryAttempt): Promise<void>;
    getEvent(eventId: string): Promise<WebhookEvent | undefined>;
    hasSuccessfulDelivery(eventId: string): Promise<boolean>;
    markDeadLetter(deadLetter: DeadLetter): Promise<void>;
    getDeadLetter(eventId: string): Promise<DeadLetter | undefined>;
    clearDeadLetter(eventId: string): Promise<void>;
    getAttempts(eventId: string): Promise<DeliveryAttempt[]>;
    listDeadLetters(): Promise<DeadLetter[]>;
    onModuleDestroy(): Promise<void>;
    private ensureSchema;
}

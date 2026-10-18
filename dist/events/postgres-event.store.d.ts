import { OnModuleDestroy } from '@nestjs/common';
import { DeadLetter, DeliveryAttempt, EventStore, WebhookEvent } from './event-store';
export declare class PostgresEventStore implements EventStore, OnModuleDestroy {
    private readonly pool;
    private schemaReady?;
    saveIfNew(event: WebhookEvent): Promise<boolean>;
    recordAttempt(attempt: DeliveryAttempt): Promise<void>;
    markDeadLetter(deadLetter: DeadLetter): Promise<void>;
    getAttempts(eventId: string): Promise<DeliveryAttempt[]>;
    listDeadLetters(): Promise<DeadLetter[]>;
    onModuleDestroy(): Promise<void>;
    private ensureSchema;
}

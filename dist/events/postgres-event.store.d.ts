import { OnModuleDestroy } from '@nestjs/common';
import { EventStore, WebhookEvent } from './event-store';
export declare class PostgresEventStore implements EventStore, OnModuleDestroy {
    private readonly pool;
    private schemaReady?;
    saveIfNew(event: WebhookEvent): Promise<boolean>;
    onModuleDestroy(): Promise<void>;
    private ensureSchema;
}

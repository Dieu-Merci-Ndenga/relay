import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { EventStore } from '../events/event-store';
export declare class BullMqDeliveryWorker implements OnModuleInit, OnModuleDestroy {
    private readonly eventStore;
    private readonly connection;
    private worker?;
    constructor(eventStore: EventStore);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}

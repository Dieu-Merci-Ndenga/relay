import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare class BullMqDeliveryWorker implements OnModuleInit, OnModuleDestroy {
    private readonly connection;
    private worker?;
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}

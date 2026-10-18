import { OnModuleDestroy } from '@nestjs/common';
import { DeliveryJob, DeliveryQueue } from './delivery-queue';
export declare class BullMqDeliveryQueue implements DeliveryQueue, OnModuleDestroy {
    private readonly connection;
    private readonly queue;
    enqueue(job: DeliveryJob): Promise<void>;
    onModuleDestroy(): Promise<void>;
}

import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { EventStore } from '../events/event-store';
import { MetricsService } from '../metrics/metrics.service';
import type { DeliveryQueue } from './delivery-queue';
export type OutboxSweeperOptions = {
    intervalMs: number;
    graceMs: number;
    batchSize: number;
};
export declare class OutboxSweeper implements OnModuleInit, OnModuleDestroy {
    private readonly eventStore;
    private readonly deliveryQueue;
    private readonly metrics;
    private readonly options;
    private readonly logger;
    private timer?;
    private running;
    constructor(eventStore: EventStore, deliveryQueue: DeliveryQueue, metrics: MetricsService, options: OutboxSweeperOptions);
    onModuleInit(): void;
    onModuleDestroy(): void;
    sweepOnce(): Promise<number>;
    private sweepSafely;
}

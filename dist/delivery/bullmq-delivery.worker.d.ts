import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DeliveryJob } from './delivery-queue';
import { RetryScheduler } from './delivery-processor';
import type { EventStore } from '../events/event-store';
import { MetricsService } from '../metrics/metrics.service';
export declare class BullMqDeliveryWorker implements OnModuleInit, OnModuleDestroy, RetryScheduler {
    private readonly eventStore;
    private readonly metrics;
    private readonly connection;
    private readonly retryQueue;
    private workers;
    constructor(eventStore: EventStore, metrics: MetricsService);
    scheduleRetry(job: DeliveryJob, jobId: string, delayMs: number): Promise<void>;
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}

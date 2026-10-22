import type { EventStore } from '../events/event-store';
import { MetricsService } from '../metrics/metrics.service';
import { DeliveryJob } from './delivery-queue';
export type DeliveryConfig = {
    url: string;
    secret: string;
    maxAttempts: number;
    backoffBaseMs: number;
    timeoutMs?: number;
};
export interface RetryScheduler {
    scheduleRetry(job: DeliveryJob, jobId: string, delayMs: number): Promise<void>;
}
export type JobContext = {
    jobId: string;
    queueLagMs: number;
};
type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
export declare function backoffDelayMs(failedAttempt: number, baseMs: number): number;
export declare class DeliveryProcessor {
    private readonly eventStore;
    private readonly scheduler;
    private readonly metrics;
    private readonly config;
    private readonly fetchFn;
    private readonly logger;
    constructor(eventStore: EventStore, scheduler: RetryScheduler, metrics: MetricsService, config: DeliveryConfig, fetchFn?: FetchFn);
    process(job: DeliveryJob, context: JobContext): Promise<void>;
    private handleFailure;
    private deadLetter;
}
export {};

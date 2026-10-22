export declare const DELIVERY_QUEUE: unique symbol;
export declare const DELIVERY_WORKER: unique symbol;
export type DeliveryJob = {
    eventId: string;
    source: string;
    payload: unknown;
    attempt?: number;
    origin?: string;
};
export interface DeliveryQueue {
    enqueue(job: DeliveryJob, jobId?: string): Promise<void>;
}
export declare function deliveryJobId(source: string, eventId: string): string;
export declare function manualRetryJobId(source: string, eventId: string, timestamp: number): string;
export declare function retryJobId(origin: string, attempt: number): string;

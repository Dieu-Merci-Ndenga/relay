export declare const DELIVERY_QUEUE: unique symbol;
export declare const DELIVERY_WORKER: unique symbol;
export type DeliveryJob = {
    eventId: string;
    source: string;
    payload: unknown;
};
export interface DeliveryQueue {
    enqueue(job: DeliveryJob, jobId?: string): Promise<void>;
}

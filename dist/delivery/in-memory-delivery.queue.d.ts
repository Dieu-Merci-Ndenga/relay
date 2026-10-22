import { DeliveryJob, DeliveryQueue } from './delivery-queue';
export declare class InMemoryDeliveryQueue implements DeliveryQueue {
    readonly jobs: DeliveryJob[];
    private readonly jobIds;
    enqueue(job: DeliveryJob, jobId?: string): Promise<void>;
}

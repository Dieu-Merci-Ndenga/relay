import { DeliveryJob, DeliveryQueue } from './delivery-queue';
export declare class InMemoryDeliveryQueue implements DeliveryQueue {
    readonly jobs: DeliveryJob[];
    enqueue(job: DeliveryJob, _jobId?: string): Promise<void>;
}

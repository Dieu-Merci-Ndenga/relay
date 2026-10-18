export const DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE');
export const DELIVERY_WORKER = Symbol('DELIVERY_WORKER');

export type DeliveryJob = {
  eventId: string;
  source: string;
  payload: unknown;
};

export interface DeliveryQueue {
  enqueue(job: DeliveryJob, jobId?: string): Promise<void>;
}
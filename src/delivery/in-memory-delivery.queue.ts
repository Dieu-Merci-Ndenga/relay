import { Injectable } from '@nestjs/common';
import { DeliveryJob, DeliveryQueue } from './delivery-queue';

@Injectable()
export class InMemoryDeliveryQueue implements DeliveryQueue {
  readonly jobs: DeliveryJob[] = [];

  async enqueue(job: DeliveryJob, _jobId?: string): Promise<void> {
    this.jobs.push(job);
  }
}
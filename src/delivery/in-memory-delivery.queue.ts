import { Injectable } from '@nestjs/common';
import { DeliveryJob, DeliveryQueue } from './delivery-queue';

@Injectable()
export class InMemoryDeliveryQueue implements DeliveryQueue {
  readonly jobs: DeliveryJob[] = [];
  private readonly jobIds = new Set<string>();

  async enqueue(job: DeliveryJob, jobId = job.eventId): Promise<void> {
    if (this.jobIds.has(jobId)) {
      return;
    }

    this.jobIds.add(jobId);
    this.jobs.push(job);
  }
}

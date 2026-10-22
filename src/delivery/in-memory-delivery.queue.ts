import { Injectable } from '@nestjs/common';
import { DeliveryJob, DeliveryQueue, deliveryJobId } from './delivery-queue';

@Injectable()
export class InMemoryDeliveryQueue implements DeliveryQueue {
  readonly jobs: DeliveryJob[] = [];
  private readonly jobIds = new Set<string>();

  async enqueue(
    job: DeliveryJob,
    jobId = deliveryJobId(job.source, job.eventId),
  ): Promise<void> {
    if (this.jobIds.has(jobId)) {
      return;
    }

    this.jobIds.add(jobId);
    this.jobs.push(job);
  }
}

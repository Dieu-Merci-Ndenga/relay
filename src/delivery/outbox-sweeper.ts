import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { EventStore } from '../events/event-store';
import { MetricsService } from '../metrics/metrics.service';
import type { DeliveryQueue } from './delivery-queue';

export type OutboxSweeperOptions = {
  // 0 disables the periodic sweep; sweepOnce() can still be called directly.
  intervalMs: number;
  // Minimum age before an unacknowledged event is considered stuck, so the
  // sweeper does not race with requests that are still being processed.
  graceMs: number;
  batchSize: number;
};

// Re-enqueues events that were stored but never acknowledged as enqueued, e.g.
// because the process or Redis failed between the database write and the
// queue insertion and the provider never retried.
export class OutboxSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxSweeper.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly eventStore: EventStore,
    private readonly deliveryQueue: DeliveryQueue,
    private readonly metrics: MetricsService,
    private readonly options: OutboxSweeperOptions,
  ) {}

  onModuleInit(): void {
    this.metrics.onOutboxPending(() => this.eventStore.countPendingEnqueue());

    if (this.options.intervalMs > 0) {
      this.timer = setInterval(
        () => void this.sweepSafely(),
        this.options.intervalMs,
      );
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async sweepOnce(): Promise<number> {
    const pending = await this.eventStore.listPendingEnqueue(
      this.options.graceMs,
      this.options.batchSize,
    );
    let requeued = 0;

    for (const event of pending) {
      try {
        // Delivered events only lost their acknowledgement; re-enqueueing
        // them would deliver twice once the completed job has been trimmed.
        if (!(await this.eventStore.hasSuccessfulDelivery(event))) {
          await this.deliveryQueue.enqueue(event);
          requeued += 1;
        }
        await this.eventStore.markEnqueued(event);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Could not re-enqueue ${event.source}/${event.eventId}: ${detail}`,
        );
      }
    }

    this.metrics.recordOutboxRequeued(requeued);
    return requeued;
  }

  private async sweepSafely(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const requeued = await this.sweepOnce();
      if (requeued > 0) {
        this.logger.log(`Re-enqueued ${requeued} stuck event(s)`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Outbox sweep failed: ${detail}`);
    } finally {
      this.running = false;
    }
  }
}

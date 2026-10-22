import { Logger } from '@nestjs/common';
import type { EventStore } from '../events/event-store';
import { MetricsService } from '../metrics/metrics.service';
import { signPayload } from '../signature';
import { DeliveryJob, retryJobId } from './delivery-queue';

export type DeliveryConfig = {
  url: string;
  secret: string;
  maxAttempts: number;
  backoffBaseMs: number;
  timeoutMs?: number;
};

export interface RetryScheduler {
  scheduleRetry(
    job: DeliveryJob,
    jobId: string,
    delayMs: number,
  ): Promise<void>;
}

export type JobContext = {
  jobId: string;
  // Milliseconds the job waited after it became eligible to run.
  queueLagMs: number;
};

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

// Exponential backoff: delay, 2x delay, 4x delay, ...
export function backoffDelayMs(failedAttempt: number, baseMs: number): number {
  return baseMs * 2 ** (failedAttempt - 1);
}

export class DeliveryProcessor {
  private readonly logger = new Logger(DeliveryProcessor.name);

  constructor(
    private readonly eventStore: EventStore,
    private readonly scheduler: RetryScheduler,
    private readonly metrics: MetricsService,
    private readonly config: DeliveryConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async process(job: DeliveryJob, context: JobContext): Promise<void> {
    const attempt = job.attempt ?? 1;
    const kind = attempt === 1 ? 'first' : 'retry';
    const startedAt = Date.now();
    const key = { source: job.source, eventId: job.eventId };

    this.metrics.recordQueueLag(kind, context.queueLagMs);

    // The signature covers exactly the bytes sent, like inbound webhooks.
    const body = JSON.stringify(job.payload);
    let httpStatus: number | undefined;
    let failure: string | undefined;

    try {
      const response = await this.fetchFn(this.config.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-relay-event-id': job.eventId,
          'x-relay-source': job.source,
          'x-relay-signature': signPayload(body, this.config.secret),
        },
        body,
        // A receiver must not hang a worker or bounce us to another host.
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
      });
      httpStatus = response.status;

      if (!response.ok) {
        failure = `Delivery failed with HTTP ${response.status}`;
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    const durationMs = Date.now() - startedAt;
    const outcome = failure === undefined ? 'delivered' : 'failed';
    this.metrics.recordAttempt(job.source, kind, outcome, durationMs);

    await this.eventStore.recordAttempt({
      ...key,
      attemptNumber: attempt,
      status: outcome,
      httpStatus,
      error: failure,
      durationMs,
    });

    if (failure === undefined) {
      await this.eventStore.clearDeadLetter(key);
      return;
    }

    await this.handleFailure(job, context, attempt, failure);
  }

  private async handleFailure(
    job: DeliveryJob,
    context: JobContext,
    attempt: number,
    reason: string,
  ): Promise<void> {
    const key = { source: job.source, eventId: job.eventId };

    if (attempt >= this.config.maxAttempts) {
      await this.deadLetter(key, reason);
      return;
    }

    const origin = job.origin ?? context.jobId;
    const next = attempt + 1;

    try {
      await this.scheduler.scheduleRetry(
        { ...job, attempt: next, origin },
        retryJobId(origin, next),
        backoffDelayMs(attempt, this.config.backoffBaseMs),
      );
    } catch (error) {
      // Without a scheduled retry the event would be silently lost, so it is
      // surfaced in the dead-letter queue where it can be retried manually.
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not schedule retry ${next} for ${key.source}/${key.eventId}: ${detail}`,
      );
      await this.deadLetter(key, `${reason} (retry not scheduled: ${detail})`);
    }
  }

  private async deadLetter(
    key: { source: string; eventId: string },
    reason: string,
  ): Promise<void> {
    await this.eventStore.markDeadLetter({ ...key, reason });
    this.metrics.recordDeadLetter(key.source);
  }
}

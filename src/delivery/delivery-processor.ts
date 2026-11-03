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
  backoffJitterRatio?: number;
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

function errorCause(error: unknown): string | undefined {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause === undefined) {
    return undefined;
  }
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    const code = cause.code;
    if (typeof code === 'string') {
      return code;
    }
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === 'object' && cause !== null) {
    const message = 'message' in cause ? cause.message : undefined;
    if (typeof message === 'string') {
      return message;
    }
    try {
      return JSON.stringify(cause);
    } catch {
      return '[unserializable cause]';
    }
  }
  if (
    typeof cause === 'number' ||
    typeof cause === 'boolean' ||
    typeof cause === 'bigint'
  ) {
    return cause.toString();
  }
  if (typeof cause === 'string') {
    return cause;
  }
  return typeof cause === 'symbol'
    ? (cause.description ?? 'Symbol')
    : 'Unknown cause';
}

// Exponential backoff with symmetric jitter to spread synchronized retries.
export function backoffDelayMs(
  failedAttempt: number,
  baseMs: number,
  jitterRatio = 0.2,
  random = Math.random,
): number {
  const exponentialDelay = baseMs * 2 ** (failedAttempt - 1);
  const boundedJitter = Math.max(0, Math.min(jitterRatio, 1));
  const jitter = 1 - boundedJitter + random() * boundedJitter * 2;

  return Math.round(exponentialDelay * jitter);
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

    const expiresAt = job.expiresAt ? Date.parse(job.expiresAt) : undefined;
    if (expiresAt !== undefined && expiresAt <= startedAt) {
      const reason = 'Event expired before delivery';
      this.metrics.recordAttempt(job.source, kind, 'expired', 0);
      await this.eventStore.recordAttempt({
        ...key,
        attemptNumber: attempt,
        status: 'expired',
        error: reason,
        durationMs: 0,
      });
      await this.deadLetter(key, reason, 'EXPIRED');
      return;
    }

    // The signature covers exactly the bytes sent, like inbound webhooks.
    const body = JSON.stringify(job.payload);
    let failure: string | undefined;
    let failureCause: string | undefined;
    let httpStatus: number | undefined;
    let expiredDuringAttempt = false;
    const requestTimeoutMs =
      expiresAt === undefined
        ? (this.config.timeoutMs ?? 10_000)
        : Math.max(
            1,
            Math.min(this.config.timeoutMs ?? 10_000, expiresAt - Date.now()),
          );

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
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      httpStatus = response.status;

      if (!response.ok) {
        failure = `Delivery failed with HTTP ${response.status}`;
      } else if (expiresAt !== undefined && Date.now() >= expiresAt) {
        failure = 'Event expired before successful delivery';
        expiredDuringAttempt = true;
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      failureCause = errorCause(error);
      expiredDuringAttempt = expiresAt !== undefined && Date.now() >= expiresAt;
    }

    const durationMs = Date.now() - startedAt;
    const outcome = failure === undefined ? 'delivered' : 'failed';
    const attemptStatus = expiredDuringAttempt ? 'expired' : outcome;
    this.metrics.recordAttempt(job.source, kind, attemptStatus, durationMs);

    await this.eventStore.recordAttempt({
      ...key,
      attemptNumber: attempt,
      status: attemptStatus,
      httpStatus,
      error: failure,
      errorCause: failureCause,
      durationMs,
    });

    if (failure === undefined) {
      await this.eventStore.clearDeadLetter(key);
      return;
    }
    if (expiredDuringAttempt) {
      await this.deadLetter(key, failure, 'EXPIRED');
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
    const delayMs = backoffDelayMs(
      attempt,
      this.config.backoffBaseMs,
      this.config.backoffJitterRatio,
    );

    if (job.expiresAt && Date.now() + delayMs >= Date.parse(job.expiresAt)) {
      await this.deadLetter(
        key,
        'Event expires before the next retry',
        'EXPIRED',
      );
      return;
    }

    try {
      await this.scheduler.scheduleRetry(
        { ...job, attempt: next, origin },
        retryJobId(origin, next),
        delayMs,
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
    status: 'DEAD_LETTERED' | 'EXPIRED' = 'DEAD_LETTERED',
  ): Promise<void> {
    await this.eventStore.markDeadLetter({ ...key, reason, status });
    this.metrics.recordDeadLetter(key.source);
  }
}

export const EVENT_STORE = Symbol('EVENT_STORE');
export const OUTBOX_CLAIM_TIMEOUT_MS = 60_000;

// An event is identified by its source and the id the source gave it, so two
// providers can reuse the same event id without colliding.
export type EventKey = {
  source: string;
  eventId: string;
};

export type WebhookEvent = EventKey & {
  payload: unknown;
  expiresAt?: string;
};

export type DeliveryAttempt = EventKey & {
  attemptNumber: number;
  status: 'delivered' | 'failed' | 'expired';
  httpStatus?: number;
  error?: string;
  errorCause?: string;
  durationMs: number;
  createdAt?: string;
};

export type DeadLetter = EventKey & {
  reason: string;
  status?: 'DEAD_LETTERED' | 'EXPIRED';
};

export interface EventStore {
  /** Returns true when the event was stored, false when it already existed. */
  saveIfNew(event: WebhookEvent): Promise<boolean>;
  getEvent(key: EventKey): Promise<WebhookEvent | undefined>;
  findSources(eventId: string): Promise<string[]>;
  hasSuccessfulDelivery(key: EventKey): Promise<boolean>;
  /** Records that the event reached the delivery queue (outbox acknowledgement). */
  markEnqueued(key: EventKey): Promise<void>;
  /** Atomically claims pending events that are old enough for enqueue recovery. */
  claimPendingEnqueue(
    olderThanMs: number,
    limit: number,
  ): Promise<WebhookEvent[]>;
  /** Releases a claim when enqueueing fails, allowing the next sweep to retry. */
  releaseEnqueueClaim(key: EventKey): Promise<void>;
  countPendingEnqueue(): Promise<number>;
  recordAttempt(attempt: DeliveryAttempt): Promise<void>;
  markDeadLetter(deadLetter: DeadLetter): Promise<void>;
  getDeadLetter(key: EventKey): Promise<DeadLetter | undefined>;
  clearDeadLetter(key: EventKey): Promise<void>;
  getAttempts(key: EventKey): Promise<DeliveryAttempt[]>;
  listDeadLetters(): Promise<DeadLetter[]>;
}

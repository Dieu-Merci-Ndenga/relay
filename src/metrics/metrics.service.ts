import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export type AttemptKind = 'first' | 'retry';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private pendingOutbox?: () => Promise<number>;

  private readonly eventsReceived = new Counter({
    name: 'relay_events_received_total',
    help: 'Webhook events accepted, by source and whether they were new or duplicates.',
    labelNames: ['source', 'result'],
    registers: [this.registry],
  });
  private readonly deliveryAttempts = new Counter({
    name: 'relay_delivery_attempts_total',
    help: 'Delivery attempts, by source, kind and outcome.',
    labelNames: ['source', 'kind', 'outcome'],
    registers: [this.registry],
  });
  private readonly deliveryDuration = new Histogram({
    name: 'relay_delivery_duration_seconds',
    help: 'Duration of delivery HTTP calls.',
    labelNames: ['outcome'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [this.registry],
  });
  private readonly queueLag = new Histogram({
    name: 'relay_delivery_queue_lag_seconds',
    help: 'Time a delivery job waited in the queue after it became eligible.',
    labelNames: ['kind'],
    buckets: [0.01, 0.05, 0.25, 1, 5, 15, 60, 300],
    registers: [this.registry],
  });
  private readonly deadLetters = new Counter({
    name: 'relay_dead_letters_total',
    help: 'Events moved to the dead-letter queue.',
    labelNames: ['source'],
    registers: [this.registry],
  });
  private readonly outboxRequeued = new Counter({
    name: 'relay_outbox_requeued_total',
    help: 'Events re-enqueued by the outbox sweeper.',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    const pendingOutbox = () => this.pendingOutbox;
    new Gauge({
      name: 'relay_outbox_pending_events',
      help: 'Stored events not yet acknowledged as enqueued.',
      registers: [this.registry],
      async collect() {
        const provider = pendingOutbox();
        if (provider) {
          this.set(await provider());
        }
      },
    });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  onOutboxPending(provider: () => Promise<number>): void {
    this.pendingOutbox = provider;
  }

  recordEvent(source: string, result: 'new' | 'duplicate'): void {
    this.eventsReceived.inc({ source, result });
  }

  recordAttempt(
    source: string,
    kind: AttemptKind,
    outcome: 'delivered' | 'failed',
    durationMs: number,
  ): void {
    this.deliveryAttempts.inc({ source, kind, outcome });
    this.deliveryDuration.observe({ outcome }, durationMs / 1000);
  }

  recordQueueLag(kind: AttemptKind, lagMs: number): void {
    this.queueLag.observe({ kind }, Math.max(lagMs, 0) / 1000);
  }

  recordDeadLetter(source: string): void {
    this.deadLetters.inc({ source });
  }

  recordOutboxRequeued(count: number): void {
    this.outboxRequeued.inc(count);
  }
}

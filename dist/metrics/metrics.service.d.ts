export type AttemptKind = 'first' | 'retry';
export declare class MetricsService {
    private readonly registry;
    private pendingOutbox?;
    private readonly eventsReceived;
    private readonly deliveryAttempts;
    private readonly deliveryDuration;
    private readonly queueLag;
    private readonly deadLetters;
    private readonly outboxRequeued;
    constructor();
    get contentType(): string;
    metrics(): Promise<string>;
    onOutboxPending(provider: () => Promise<number>): void;
    recordEvent(source: string, result: 'new' | 'duplicate'): void;
    recordAttempt(source: string, kind: AttemptKind, outcome: 'delivered' | 'failed', durationMs: number): void;
    recordQueueLag(kind: AttemptKind, lagMs: number): void;
    recordDeadLetter(source: string): void;
    recordOutboxRequeued(count: number): void;
}

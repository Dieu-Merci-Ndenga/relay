export declare const EVENT_STORE: unique symbol;
export type EventKey = {
    source: string;
    eventId: string;
};
export type WebhookEvent = EventKey & {
    payload: unknown;
};
export type DeliveryAttempt = EventKey & {
    attemptNumber: number;
    status: 'delivered' | 'failed';
    httpStatus?: number;
    error?: string;
    durationMs: number;
    createdAt?: string;
};
export type DeadLetter = EventKey & {
    reason: string;
};
export interface EventStore {
    saveIfNew(event: WebhookEvent): Promise<boolean>;
    getEvent(key: EventKey): Promise<WebhookEvent | undefined>;
    findSources(eventId: string): Promise<string[]>;
    hasSuccessfulDelivery(key: EventKey): Promise<boolean>;
    markEnqueued(key: EventKey): Promise<void>;
    listPendingEnqueue(olderThanMs: number, limit: number): Promise<WebhookEvent[]>;
    countPendingEnqueue(): Promise<number>;
    recordAttempt(attempt: DeliveryAttempt): Promise<void>;
    markDeadLetter(deadLetter: DeadLetter): Promise<void>;
    getDeadLetter(key: EventKey): Promise<DeadLetter | undefined>;
    clearDeadLetter(key: EventKey): Promise<void>;
    getAttempts(key: EventKey): Promise<DeliveryAttempt[]>;
    listDeadLetters(): Promise<DeadLetter[]>;
}

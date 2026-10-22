import { EventKey, WebhookEvent } from './events/event-store';
import type { EventStore } from './events/event-store';
import type { DeliveryQueue } from './delivery/delivery-queue';
import { MetricsService } from './metrics/metrics.service';
export declare class AppService {
    private readonly eventStore;
    private readonly deliveryQueue;
    private readonly metrics;
    private readonly secret;
    constructor(eventStore: EventStore, deliveryQueue: DeliveryQueue, metrics: MetricsService);
    verifySignature(rawBody: Buffer | undefined, signature: string): boolean;
    acceptEvent(event: WebhookEvent): Promise<{
        accepted: boolean;
        duplicate: boolean;
        eventId: string;
        status: string;
    }>;
    retryEvent(key: EventKey): Promise<{
        source: string;
        eventId: string;
        status: string;
    }>;
    getAttempts(key: EventKey): Promise<import("./events/event-store").DeliveryAttempt[]>;
    getAttemptsByEventId(eventId: string): Promise<import("./events/event-store").DeliveryAttempt[] | never[]>;
    listDeadLetters(): Promise<import("./events/event-store").DeadLetter[]>;
    resolveKey(eventId: string): Promise<EventKey>;
}

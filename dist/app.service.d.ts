import { WebhookEvent } from './events/event-store';
import type { EventStore } from './events/event-store';
import type { DeliveryQueue } from './delivery/delivery-queue';
export declare class AppService {
    private readonly eventStore;
    private readonly deliveryQueue;
    private readonly secret;
    constructor(eventStore: EventStore, deliveryQueue: DeliveryQueue);
    verifySignature(rawBody: Buffer | undefined, signature: string): boolean;
    acceptEvent(event: WebhookEvent): Promise<{
        accepted: boolean;
        duplicate: boolean;
        eventId: string;
        status: string;
    }>;
    retryEvent(eventId: string): Promise<{
        eventId: string;
        status: string;
    }>;
    getAttempts(eventId: string): Promise<import("./events/event-store").DeliveryAttempt[]>;
    listDeadLetters(): Promise<import("./events/event-store").DeadLetter[]>;
}

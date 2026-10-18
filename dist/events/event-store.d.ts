export declare const EVENT_STORE: unique symbol;
export type WebhookEvent = {
    eventId: string;
    source: string;
    payload: unknown;
};
export interface EventStore {
    saveIfNew(event: WebhookEvent): Promise<boolean>;
}

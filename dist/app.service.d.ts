type WebhookEvent = {
    eventId: string;
    source: string;
    payload: unknown;
};
export declare class AppService {
    private readonly events;
    private readonly secret;
    verifySignature(rawBody: Buffer | undefined, signature: string): boolean;
    acceptEvent(event: WebhookEvent): {
        accepted: boolean;
        duplicate: boolean;
        eventId: string;
        status: string;
    };
}
export {};

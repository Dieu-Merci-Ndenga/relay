import { Request } from 'express';
import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    receiveWebhook(source: string, eventId: string | undefined, signature: string | undefined, request: Request & {
        rawBody?: Buffer;
    }): Promise<{
        accepted: boolean;
        duplicate: boolean;
        eventId: string;
        status: string;
    }>;
    getAttempts(eventId: string): Promise<import("./events/event-store").DeliveryAttempt[]>;
    getDeadLetters(): Promise<import("./events/event-store").DeadLetter[]>;
    retryEvent(eventId: string): Promise<{
        eventId: string;
        status: string;
    }>;
}

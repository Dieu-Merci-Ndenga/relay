import type { Request, Response } from 'express';
import { AppService } from './app.service';
import { MetricsService } from './metrics/metrics.service';
export declare class AppController {
    private readonly appService;
    private readonly metrics;
    constructor(appService: AppService, metrics: MetricsService);
    health(): {
        status: string;
    };
    getMetrics(authorization: string | undefined, response: Response): Promise<string>;
    receiveWebhook(source: string, eventId: string | undefined, signature: string | undefined, request: Request & {
        rawBody?: Buffer;
    }): Promise<{
        accepted: boolean;
        duplicate: boolean;
        eventId: string;
        status: string;
    }>;
    getAttempts(source: string, eventId: string): Promise<import("./events/event-store").DeliveryAttempt[]>;
    retryEvent(source: string, eventId: string): Promise<{
        source: string;
        eventId: string;
        status: string;
    }>;
    getAttemptsByEventId(eventId: string): Promise<import("./events/event-store").DeliveryAttempt[] | never[]>;
    retryEventByEventId(eventId: string): Promise<{
        source: string;
        eventId: string;
        status: string;
    }>;
    getDeadLetters(): Promise<import("./events/event-store").DeadLetter[]>;
}

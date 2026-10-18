import { Request } from 'express';
import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    receiveWebhook(source: string, eventId: string | undefined, signature: string | undefined, request: Request & {
        rawBody?: Buffer;
    }): {
        accepted: boolean;
        duplicate: boolean;
        eventId: string;
        status: string;
    };
}

import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('webhooks/:source')
  async receiveWebhook(
    @Param('source') source: string,
    @Headers('x-relay-event-id') eventId: string | undefined,
    @Headers('x-relay-signature') signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    if (!eventId) {
      throw new BadRequestException('x-relay-event-id is required');
    }

    if (!signature || !this.appService.verifySignature(request.rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return this.appService.acceptEvent({
      eventId,
      source,
      payload: request.body,
    });
  }
}

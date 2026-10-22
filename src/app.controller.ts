import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppService } from './app.service';
import { MetricsService } from './metrics/metrics.service';
import { safeEqual } from './signature';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // Open by default; set METRICS_TOKEN to require `Authorization: Bearer <token>`.
  @Get('metrics')
  async getMetrics(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = process.env.METRICS_TOKEN;

    if (token && !safeEqual(authorization ?? '', `Bearer ${token}`)) {
      throw new UnauthorizedException('Invalid metrics token');
    }

    response.type(this.metrics.contentType);
    return this.metrics.metrics();
  }

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

    if (
      !signature ||
      !this.appService.verifySignature(request.rawBody, signature)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return this.appService.acceptEvent({
      eventId,
      source,
      payload: request.body,
    });
  }

  @Get('events/:source/:eventId/attempts')
  getAttempts(
    @Param('source') source: string,
    @Param('eventId') eventId: string,
  ) {
    return this.appService.getAttempts({ source, eventId });
  }

  @Post('events/:source/:eventId/retry')
  retryEvent(
    @Param('source') source: string,
    @Param('eventId') eventId: string,
  ) {
    return this.appService.retryEvent({ source, eventId });
  }

  // Legacy routes: only valid while the event id is unique across sources.
  @Get('events/:eventId/attempts')
  getAttemptsByEventId(@Param('eventId') eventId: string) {
    return this.appService.getAttemptsByEventId(eventId);
  }

  @Post('events/:eventId/retry')
  async retryEventByEventId(@Param('eventId') eventId: string) {
    return this.appService.retryEvent(
      await this.appService.resolveKey(eventId),
    );
  }

  @Get('dead-letters')
  getDeadLetters() {
    return this.appService.listDeadLetters();
  }
}

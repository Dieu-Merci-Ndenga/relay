import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { adminToken } from './config/secrets';
import { safeEqual } from './signature';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly token = adminToken();

  canActivate(context: ExecutionContext): boolean {
    if (!this.token) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';

    if (!safeEqual(header, `Bearer ${this.token}`)) {
      throw new UnauthorizedException('Invalid or missing admin token');
    }

    return true;
  }
}

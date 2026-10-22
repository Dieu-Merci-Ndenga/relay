import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  }) as unknown as ExecutionContext;

describe('AdminGuard', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('is open when no token is configured outside production', () => {
    delete process.env.ADMIN_TOKEN;
    process.env.NODE_ENV = 'development';
    expect(new AdminGuard().canActivate(contextWith())).toBe(true);
  });

  it('requires the bearer token when configured', () => {
    process.env.ADMIN_TOKEN = 'op-token';
    const guard = new AdminGuard();

    expect(guard.canActivate(contextWith('Bearer op-token'))).toBe(true);
    expect(() => guard.canActivate(contextWith())).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(contextWith('Bearer nope'))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses to start in production without a token', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_TOKEN;
    expect(() => new AdminGuard()).toThrow(/ADMIN_TOKEN/);
  });
});

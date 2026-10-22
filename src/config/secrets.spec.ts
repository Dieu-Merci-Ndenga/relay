import { deliverySecret, isValidId, webhookSecret } from './secrets';

describe('secrets', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('refuses missing or default secrets in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEBHOOK_SECRET;
    expect(() => webhookSecret()).toThrow(/WEBHOOK_SECRET/);

    process.env.WEBHOOK_SECRET = 'dev-secret';
    expect(() => deliverySecret()).toThrow();

    process.env.WEBHOOK_SECRET = 'a-long-random-value';
    expect(webhookSecret()).toBe('a-long-random-value');
    expect(deliverySecret()).toBe('a-long-random-value');
  });

  it('falls back to the dev secret outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.WEBHOOK_SECRET;
    delete process.env.DELIVERY_SECRET;
    expect(webhookSecret()).toBe('dev-secret');
  });

  it('validates ids', () => {
    expect(isValidId('evt_1:a-b.c')).toBe(true);
    expect(isValidId('')).toBe(false);
    expect(isValidId('a'.repeat(129))).toBe(false);
    expect(isValidId('bad id\r\n')).toBe(false);
    expect(isValidId('../x')).toBe(false);
  });
});

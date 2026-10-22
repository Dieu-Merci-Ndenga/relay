import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function signPayload(body: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

// Constant-time comparison that does not leak the length of the secret.
export function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();

  return timingSafeEqual(digest(a), digest(b));
}

export function isValidSignature(
  body: Buffer | string,
  signature: string,
  secret: string,
): boolean {
  return safeEqual(signPayload(body, secret), signature);
}

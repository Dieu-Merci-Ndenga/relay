const DEV_SECRET = 'dev-secret';

// Outside production the documented dev secret keeps local setups working; in
// production a missing or default secret is a startup error, not a silent hole.
function resolve(name: string, value: string | undefined): string {
  if (process.env.NODE_ENV === 'production') {
    if (!value || value === DEV_SECRET) {
      throw new Error(
        `${name} must be set to a non-default value in production`,
      );
    }
  }

  return value ?? DEV_SECRET;
}

export function webhookSecret(): string {
  return resolve('WEBHOOK_SECRET', process.env.WEBHOOK_SECRET);
}

export function deliverySecret(): string {
  return resolve(
    'DELIVERY_SECRET (or WEBHOOK_SECRET)',
    process.env.DELIVERY_SECRET ?? process.env.WEBHOOK_SECRET,
  );
}

// Source and event ids end up in URLs, job ids and headers: keep them short
// and free of control characters.
const ID_PATTERN = /^[\w.:@+=-]{1,128}$/;

export function isValidId(value: string): boolean {
  return ID_PATTERN.test(value);
}

// Operator token for the dead-letter, attempts and retry routes. It is
// mandatory in production; locally, leaving it unset keeps the API open.
export function adminToken(): string | undefined {
  const token = process.env.ADMIN_TOKEN;

  if (process.env.NODE_ENV === 'production' && !token) {
    throw new Error('ADMIN_TOKEN must be set in production');
  }

  return token || undefined;
}

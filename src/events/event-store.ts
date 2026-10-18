export const EVENT_STORE = Symbol('EVENT_STORE');

export type WebhookEvent = {
  eventId: string;
  source: string;
  payload: unknown;
};

export type DeliveryAttempt = {
  eventId: string;
  attemptNumber: number;
  status: 'delivered' | 'failed';
  httpStatus?: number;
  error?: string;
  durationMs: number;
  createdAt?: string;
};

export type DeadLetter = {
  eventId: string;
  reason: string;
};

export interface EventStore {
  saveIfNew(event: WebhookEvent): Promise<boolean>;
  getEvent(eventId: string): Promise<WebhookEvent | undefined>;
  recordAttempt(attempt: DeliveryAttempt): Promise<void>;
  markDeadLetter(deadLetter: DeadLetter): Promise<void>;
  getDeadLetter(eventId: string): Promise<DeadLetter | undefined>;
  clearDeadLetter(eventId: string): Promise<void>;
  getAttempts(eventId: string): Promise<DeliveryAttempt[]>;
  listDeadLetters(): Promise<DeadLetter[]>;
}
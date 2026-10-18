export const EVENT_STORE = Symbol('EVENT_STORE');

export type WebhookEvent = {
  eventId: string;
  source: string;
  payload: unknown;
};

export interface EventStore {
  saveIfNew(event: WebhookEvent): Promise<boolean>;
}
export const DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE');
export const DELIVERY_WORKER = Symbol('DELIVERY_WORKER');

export type DeliveryJob = {
  eventId: string;
  source: string;
  payload: unknown;
  // 1-based number of the delivery attempt this job performs.
  attempt?: number;
  // Id of the job that started this delivery cycle; keeps retry job ids stable.
  origin?: string;
};

export interface DeliveryQueue {
  enqueue(job: DeliveryJob, jobId?: string): Promise<void>;
}

// BullMQ rejects custom ids containing ':' and ids that look like integers.
// Every non-alphanumeric character is percent-encoded, so the encoding is
// injective and '_' can safely separate the parts.
function encodePart(part: string): string {
  return encodeURIComponent(part).replace(
    /[^A-Za-z0-9%]/g,
    (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  );
}

export function deliveryJobId(source: string, eventId: string): string {
  return `${encodePart(source)}_${encodePart(eventId)}`;
}

export function manualRetryJobId(
  source: string,
  eventId: string,
  timestamp: number,
): string {
  return `manual-retry_${deliveryJobId(source, eventId)}_${timestamp}`;
}

export function retryJobId(origin: string, attempt: number): string {
  return `${origin}_retry-${attempt}`;
}

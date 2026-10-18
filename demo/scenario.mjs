import { createHmac } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const relayUrl = process.env.RELAY_URL ?? 'http://localhost:3000';
const receiverUrl = process.env.RECEIVER_URL ?? 'http://localhost:4000';
const secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';
const eventCount = Number(process.env.DEMO_EVENT_COUNT ?? 5);
const eventIds = Array.from(
  { length: eventCount },
  (_, index) => `demo-${Date.now()}-${index}`,
);

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  return { status: response.status, body: await response.json() };
}

await jsonRequest(`${receiverUrl}/control`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ available: false }),
});

const receptions = await Promise.all(
  eventIds.flatMap((eventId, index) => {
    const payload = JSON.stringify({
      event: 'payment.created',
      amount: 4200 + index,
    });
    const signature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    const headers = {
      'content-type': 'application/json',
      'x-relay-event-id': eventId,
      'x-relay-signature': signature,
    };
    const request = () =>
      jsonRequest(`${relayUrl}/webhooks/demo`, {
        method: 'POST',
        headers,
        body: payload,
      });

    return [request(), request()];
  }),
);

await wait(1500);
await jsonRequest(`${receiverUrl}/control`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ available: true }),
});
await wait(2500);

const attemptsByEvent = await Promise.all(
  eventIds.map(async (eventId) => ({
    eventId,
    attempts: (await jsonRequest(`${relayUrl}/events/${eventId}/attempts`)).body,
  })),
);
const receiver = await jsonRequest(`${receiverUrl}/status`);
const attempts = attemptsByEvent.flatMap((item) => item.attempts);
const deliveredAttempts = attempts.filter(
  (attempt) => attempt.status === 'delivered',
);
const failedAttempts = attempts.filter((attempt) => attempt.status === 'failed');
const report = {
  eventCount,
  submittedRequests: receptions.length,
  acceptedRequests: receptions.filter((item) => item.status === 201).length,
  duplicateRequests: receptions.filter((item) => item.body.duplicate).length,
  totalAttempts: attempts.length,
  failedAttempts: failedAttempts.length,
  deliveredAttempts: deliveredAttempts.length,
  averageAttemptDurationMs:
    attempts.length === 0
      ? 0
      : Math.round(
          attempts.reduce((total, attempt) => total + attempt.durationMs, 0) /
            attempts.length,
        ),
  receiver: receiver.body,
  assertions: {
    retriedEveryEvent: attemptsByEvent.every((item) => item.attempts.length >= 2),
    eventuallyDeliveredEveryEvent: attemptsByEvent.every(
      (item) => item.attempts.at(-1)?.status === 'delivered',
    ),
    oneBusinessEffectPerEvent: receiver.body.appliedEffects === eventCount,
  },
};

console.log(JSON.stringify(report, null, 2));

if (process.env.REPORT_FILE) {
  await writeFile(process.env.REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
}

if (
  !report.assertions.retriedEveryEvent ||
  !report.assertions.eventuallyDeliveredEveryEvent ||
  !report.assertions.oneBusinessEffectPerEvent
) {
  process.exitCode = 1;
}
import { createHmac } from 'node:crypto';
import { InMemoryEventStore } from './events/in-memory-event.store';
import { InMemoryDeliveryQueue } from './delivery/in-memory-delivery.queue';
import { MetricsService } from './metrics/metrics.service';
import { DeliveryProcessor } from './delivery/delivery-processor';
import { OutboxSweeper } from './delivery/outbox-sweeper';
import {
  DeliveryJob,
  deliveryJobId,
  manualRetryJobId,
  retryJobId,
} from './delivery/delivery-queue';

const job: DeliveryJob = {
  source: 'stripe',
  eventId: 'evt_1',
  payload: { amount: 1 },
};
const config = {
  url: 'http://x/hook',
  secret: 's',
  maxAttempts: 3,
  backoffBaseMs: 100,
};

describe('DeliveryProcessor', () => {
  let store: InMemoryEventStore;
  let scheduled: { job: DeliveryJob; jobId: string; delay: number }[];
  const scheduler = {
    scheduleRetry: (j: DeliveryJob, jobId: string, delay: number) => {
      scheduled.push({ job: j, jobId, delay });
      return Promise.resolve();
    },
  };

  beforeEach(async () => {
    store = new InMemoryEventStore();
    scheduled = [];
    await store.saveIfNew({ ...job });
  });

  const run = (fetchFn: jest.Mock, j: DeliveryJob = job, sched = scheduler) =>
    new DeliveryProcessor(
      store,
      sched,
      new MetricsService(),
      config,
      fetchFn,
    ).process(j, {
      jobId: 'j',
      queueLagMs: 0,
    });

  it('signs the outbound body and records a delivery', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await run(fetchFn);

    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['x-relay-signature']).toBe(
      createHmac('sha256', 's')
        .update(JSON.stringify(job.payload))
        .digest('hex'),
    );
    expect(headers['x-relay-source']).toBe('stripe');
    expect(await store.hasSuccessfulDelivery(job)).toBe(true);
    expect(scheduled).toHaveLength(0);
  });

  it('schedules a backed-off retry on failure', async () => {
    await run(jest.fn().mockResolvedValue({ ok: false, status: 503 }));

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].delay).toBe(100);
    expect(scheduled[0].job.attempt).toBe(2);
    expect(await store.getDeadLetter(job)).toBeUndefined();
  });

  it('dead-letters once max attempts are reached', async () => {
    await run(jest.fn().mockResolvedValue({ ok: false, status: 500 }), {
      ...job,
      attempt: 3,
    });

    expect(scheduled).toHaveLength(0);
    expect(await store.getDeadLetter(job)).toBeTruthy();
  });

  it('dead-letters when the retry cannot be scheduled', async () => {
    await run(jest.fn().mockRejectedValue(new Error('down')), job, {
      scheduleRetry: () => Promise.reject(new Error('redis down')),
    });

    expect(await store.getDeadLetter(job)).toBeTruthy();
  });
});

describe('OutboxSweeper', () => {
  it('re-enqueues stuck events but not delivered ones', async () => {
    const store = new InMemoryEventStore();
    const queue = new InMemoryDeliveryQueue();
    await store.saveIfNew({ ...job });
    await store.saveIfNew({ ...job, eventId: 'evt_done' });
    await store.recordAttempt({
      source: 'stripe',
      eventId: 'evt_done',
      attemptNumber: 1,
      status: 'delivered',
      httpStatus: 200,
      durationMs: 1,
    });
    const sweeper = new OutboxSweeper(store, queue, new MetricsService(), {
      intervalMs: 0,
      graceMs: 0,
      batchSize: 10,
    });

    await expect(sweeper.sweepOnce()).resolves.toBe(1);
    expect(queue.jobs.map((j) => j.eventId)).toEqual(['evt_1']);
    await expect(sweeper.sweepOnce()).resolves.toBe(0);
    await expect(store.countPendingEnqueue()).resolves.toBe(0);
  });
});

describe('job ids', () => {
  it('are colon-free, non-numeric and injective', () => {
    const ids = [
      deliveryJobId('a:b', 'c'),
      deliveryJobId('a', 'b:c'),
      deliveryJobId('123', '456'),
      manualRetryJobId('a', 'b', 1),
      retryJobId('x', 2),
    ];
    for (const id of ids) {
      expect(id).not.toContain(':');
      expect(id).not.toMatch(/^\d+$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

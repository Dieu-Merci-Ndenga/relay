import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import {
  BullMqDeliveryQueue,
  RETRY_QUEUE_NAME,
} from '../src/delivery/bullmq-delivery.queue';
import { BullMqDeliveryWorker } from '../src/delivery/bullmq-delivery.worker';
import { DeliveryJob, retryJobId } from '../src/delivery/delivery-queue';
import { PostgresEventStore } from '../src/events/postgres-event.store';
import { MetricsService } from '../src/metrics/metrics.service';

let postgresContainer: StartedTestContainer;
let redisContainer: StartedTestContainer;
let eventStore: PostgresEventStore;
let deliveryQueue: BullMqDeliveryQueue;
let retryScheduler: BullMqDeliveryWorker;
let deliveryWorker: BullMqDeliveryWorker | undefined;

const waitForAttempts = async (
  key: { source: string; eventId: string },
  count: number,
) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const attempts = await eventStore.getAttempts(key);
    if (attempts.length >= count) {
      return attempts;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${count} attempts`);
};

const startReceiver = async (server: Server): Promise<number> => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return (server.address() as AddressInfo).port;
};

beforeAll(async () => {
  postgresContainer = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_DB: 'relay_test',
      POSTGRES_USER: 'relay',
      POSTGRES_PASSWORD: 'relay',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage(/database system is ready to accept connections/, 2),
    )
    .withStartupTimeout(120_000)
    .start();
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .withStartupTimeout(120_000)
    .start();

  process.env.DATABASE_URL = `postgresql://relay:relay@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/relay_test`;
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  eventStore = new PostgresEventStore();
  deliveryQueue = new BullMqDeliveryQueue();
  retryScheduler = new BullMqDeliveryWorker(eventStore, new MetricsService());
}, 180_000);

afterAll(async () => {
  await deliveryWorker?.onModuleDestroy();
  await retryScheduler?.onModuleDestroy();
  await deliveryQueue?.onModuleDestroy();
  await eventStore?.onModuleDestroy();
  await redisContainer?.stop();
  await postgresContainer?.stop();
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
  delete process.env.DELIVERY_URL;
  delete process.env.DELIVERY_TIMEOUT_MS;
  delete process.env.DELIVERY_MAX_ATTEMPTS;
  delete process.env.DELIVERY_BACKOFF_MS;
  delete process.env.DELIVERY_BACKOFF_JITTER;
  delete process.env.DELIVERY_SECRET;
});

describe('resilience integration', () => {
  it('persists expiry, error causes, and explicit expired DLQ status in PostgreSQL', async () => {
    const event = {
      source: 'integration',
      eventId: 'postgres-expiry',
      payload: { type: 'payment.created' },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    await expect(eventStore.saveIfNew(event)).resolves.toBe(true);
    await expect(eventStore.saveIfNew(event)).resolves.toBe(false);
    await expect(eventStore.getEvent(event)).resolves.toMatchObject(event);
    await eventStore.recordAttempt({
      ...event,
      attemptNumber: 1,
      status: 'failed',
      error: 'fetch failed',
      errorCause: 'ECONNREFUSED',
      durationMs: 1,
    });
    await eventStore.markDeadLetter({
      source: event.source,
      eventId: event.eventId,
      reason: 'Event expired before delivery',
      status: 'EXPIRED',
    });

    await expect(eventStore.getAttempts(event)).resolves.toMatchObject([
      { error: 'fetch failed', errorCause: 'ECONNREFUSED' },
    ]);
    await expect(eventStore.getDeadLetter(event)).resolves.toMatchObject({
      status: 'EXPIRED',
    });
  });

  it('recovers delayed retry scheduling after Redis pauses command processing', async () => {
    const job: DeliveryJob = {
      source: 'integration',
      eventId: 'redis-pause',
      payload: { type: 'payment.created' },
    };
    const inspectorConnection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
    let retryInspector: Queue<DeliveryJob> | undefined;
    const pauseCommand = redisContainer.exec([
      'redis-cli',
      'CLIENT',
      'PAUSE',
      '800',
      'ALL',
    ]);

    try {
      retryInspector = new Queue<DeliveryJob>(RETRY_QUEUE_NAME, {
        connection: inspectorConnection,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const startedAt = Date.now();
      await retryScheduler.scheduleRetry(
        job,
        retryJobId('redis-pause', 2),
        60_000,
      );
      expect(Date.now() - startedAt).toBeGreaterThan(300);
      await pauseCommand;
      await expect(
        retryInspector.getJob(retryJobId('redis-pause', 2)),
      ).resolves.toMatchObject({ data: job });
    } finally {
      await pauseCommand;
      await retryInspector?.close();
      await inspectorConnection.quit();
    }
  });

  it('retries a timed-out receiver and records both attempts across Redis and PostgreSQL', async () => {
    let requestCount = 0;
    let delayedResponse: NodeJS.Timeout | undefined;
    const server = createServer((_request, response) => {
      requestCount += 1;
      if (requestCount === 1) {
        delayedResponse = setTimeout(() => {
          if (!response.destroyed) {
            response.writeHead(200).end('late');
          }
        }, 1_000);
        return;
      }
      response.writeHead(200).end('ok');
    });
    const port = await startReceiver(server);
    process.env.DELIVERY_URL = `http://127.0.0.1:${port}/webhook`;
    process.env.DELIVERY_TIMEOUT_MS = '500';
    process.env.DELIVERY_MAX_ATTEMPTS = '2';
    process.env.DELIVERY_BACKOFF_MS = '10';
    process.env.DELIVERY_BACKOFF_JITTER = '0';
    process.env.DELIVERY_SECRET = 'integration-secret';
    deliveryWorker = new BullMqDeliveryWorker(eventStore, new MetricsService());
    deliveryWorker.onModuleInit();

    const job: DeliveryJob = {
      source: 'integration',
      eventId: 'receiver-timeout',
      payload: { type: 'payment.created' },
    };
    await eventStore.saveIfNew(job);

    try {
      await deliveryQueue.enqueue(job);
      const attempts = await waitForAttempts(job, 2);
      expect(requestCount).toBe(2);
      expect(attempts.map(({ status }) => status)).toEqual([
        'failed',
        'delivered',
      ]);
      expect(attempts[0].error).toBeDefined();
      expect(attempts[1].httpStatus).toBe(200);
    } finally {
      clearTimeout(delayedResponse);
      await deliveryWorker.onModuleDestroy();
      deliveryWorker = undefined;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

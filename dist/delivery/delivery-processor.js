"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryProcessor = void 0;
exports.backoffDelayMs = backoffDelayMs;
const common_1 = require("@nestjs/common");
const signature_1 = require("../signature");
const delivery_queue_1 = require("./delivery-queue");
function backoffDelayMs(failedAttempt, baseMs) {
    return baseMs * 2 ** (failedAttempt - 1);
}
class DeliveryProcessor {
    eventStore;
    scheduler;
    metrics;
    config;
    fetchFn;
    logger = new common_1.Logger(DeliveryProcessor.name);
    constructor(eventStore, scheduler, metrics, config, fetchFn = fetch) {
        this.eventStore = eventStore;
        this.scheduler = scheduler;
        this.metrics = metrics;
        this.config = config;
        this.fetchFn = fetchFn;
    }
    async process(job, context) {
        const attempt = job.attempt ?? 1;
        const kind = attempt === 1 ? 'first' : 'retry';
        const startedAt = Date.now();
        const key = { source: job.source, eventId: job.eventId };
        this.metrics.recordQueueLag(kind, context.queueLagMs);
        const body = JSON.stringify(job.payload);
        let httpStatus;
        let failure;
        try {
            const response = await this.fetchFn(this.config.url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-relay-event-id': job.eventId,
                    'x-relay-source': job.source,
                    'x-relay-signature': (0, signature_1.signPayload)(body, this.config.secret),
                },
                body,
                redirect: 'manual',
                signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
            });
            httpStatus = response.status;
            if (!response.ok) {
                failure = `Delivery failed with HTTP ${response.status}`;
            }
        }
        catch (error) {
            failure = error instanceof Error ? error.message : String(error);
        }
        const durationMs = Date.now() - startedAt;
        const outcome = failure === undefined ? 'delivered' : 'failed';
        this.metrics.recordAttempt(job.source, kind, outcome, durationMs);
        await this.eventStore.recordAttempt({
            ...key,
            attemptNumber: attempt,
            status: outcome,
            httpStatus,
            error: failure,
            durationMs,
        });
        if (failure === undefined) {
            await this.eventStore.clearDeadLetter(key);
            return;
        }
        await this.handleFailure(job, context, attempt, failure);
    }
    async handleFailure(job, context, attempt, reason) {
        const key = { source: job.source, eventId: job.eventId };
        if (attempt >= this.config.maxAttempts) {
            await this.deadLetter(key, reason);
            return;
        }
        const origin = job.origin ?? context.jobId;
        const next = attempt + 1;
        try {
            await this.scheduler.scheduleRetry({ ...job, attempt: next, origin }, (0, delivery_queue_1.retryJobId)(origin, next), backoffDelayMs(attempt, this.config.backoffBaseMs));
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Could not schedule retry ${next} for ${key.source}/${key.eventId}: ${detail}`);
            await this.deadLetter(key, `${reason} (retry not scheduled: ${detail})`);
        }
    }
    async deadLetter(key, reason) {
        await this.eventStore.markDeadLetter({ ...key, reason });
        this.metrics.recordDeadLetter(key.source);
    }
}
exports.DeliveryProcessor = DeliveryProcessor;
//# sourceMappingURL=delivery-processor.js.map
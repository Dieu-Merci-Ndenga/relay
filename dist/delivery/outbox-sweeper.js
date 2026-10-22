"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxSweeper = void 0;
const common_1 = require("@nestjs/common");
class OutboxSweeper {
    eventStore;
    deliveryQueue;
    metrics;
    options;
    logger = new common_1.Logger(OutboxSweeper.name);
    timer;
    running = false;
    constructor(eventStore, deliveryQueue, metrics, options) {
        this.eventStore = eventStore;
        this.deliveryQueue = deliveryQueue;
        this.metrics = metrics;
        this.options = options;
    }
    onModuleInit() {
        this.metrics.onOutboxPending(() => this.eventStore.countPendingEnqueue());
        if (this.options.intervalMs > 0) {
            this.timer = setInterval(() => void this.sweepSafely(), this.options.intervalMs);
            this.timer.unref();
        }
    }
    onModuleDestroy() {
        clearInterval(this.timer);
    }
    async sweepOnce() {
        const pending = await this.eventStore.listPendingEnqueue(this.options.graceMs, this.options.batchSize);
        let requeued = 0;
        for (const event of pending) {
            try {
                if (!(await this.eventStore.hasSuccessfulDelivery(event))) {
                    await this.deliveryQueue.enqueue(event);
                    requeued += 1;
                }
                await this.eventStore.markEnqueued(event);
            }
            catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Could not re-enqueue ${event.source}/${event.eventId}: ${detail}`);
            }
        }
        this.metrics.recordOutboxRequeued(requeued);
        return requeued;
    }
    async sweepSafely() {
        if (this.running) {
            return;
        }
        this.running = true;
        try {
            const requeued = await this.sweepOnce();
            if (requeued > 0) {
                this.logger.log(`Re-enqueued ${requeued} stuck event(s)`);
            }
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.logger.error(`Outbox sweep failed: ${detail}`);
        }
        finally {
            this.running = false;
        }
    }
}
exports.OutboxSweeper = OutboxSweeper;
//# sourceMappingURL=outbox-sweeper.js.map
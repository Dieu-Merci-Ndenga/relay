"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMqDeliveryWorker = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const QUEUE_NAME = 'relay-deliveries';
let BullMqDeliveryWorker = class BullMqDeliveryWorker {
    eventStore;
    connection = new ioredis_1.default(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    worker;
    constructor(eventStore) {
        this.eventStore = eventStore;
    }
    onModuleInit() {
        const deliveryUrl = process.env.DELIVERY_URL;
        if (!deliveryUrl) {
            return;
        }
        this.worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            const startedAt = Date.now();
            const attemptNumber = job.attemptsMade + 1;
            try {
                const response = await fetch(deliveryUrl, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-relay-event-id': job.data.eventId,
                        'x-relay-source': job.data.source,
                    },
                    body: JSON.stringify(job.data.payload),
                });
                if (!response.ok) {
                    throw new Error(`Delivery failed with HTTP ${response.status}`);
                }
                await this.eventStore.recordAttempt({
                    eventId: job.data.eventId,
                    attemptNumber,
                    status: 'delivered',
                    httpStatus: response.status,
                    durationMs: Date.now() - startedAt,
                });
                await this.eventStore.clearDeadLetter(job.data.eventId);
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                await this.eventStore.recordAttempt({
                    eventId: job.data.eventId,
                    attemptNumber,
                    status: 'failed',
                    error: reason,
                    durationMs: Date.now() - startedAt,
                });
                if (attemptNumber >= (job.opts.attempts ?? 1)) {
                    await this.eventStore.markDeadLetter({
                        eventId: job.data.eventId,
                        reason,
                    });
                }
                throw error;
            }
        }, { connection: this.connection, concurrency: 10 });
    }
    async onModuleDestroy() {
        await this.worker?.close();
        await this.connection.quit();
    }
};
exports.BullMqDeliveryWorker = BullMqDeliveryWorker;
exports.BullMqDeliveryWorker = BullMqDeliveryWorker = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], BullMqDeliveryWorker);
//# sourceMappingURL=bullmq-delivery.worker.js.map
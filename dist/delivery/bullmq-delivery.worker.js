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
const bullmq_delivery_queue_1 = require("./bullmq-delivery.queue");
const delivery_processor_1 = require("./delivery-processor");
const metrics_service_1 = require("../metrics/metrics.service");
const intFromEnv = (name, fallback) => {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};
let BullMqDeliveryWorker = class BullMqDeliveryWorker {
    eventStore;
    metrics;
    connection = new ioredis_1.default(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    retryQueue = new bullmq_1.Queue(bullmq_delivery_queue_1.RETRY_QUEUE_NAME, {
        connection: this.connection,
        defaultJobOptions: { removeOnComplete: 1000, removeOnFail: false },
    });
    workers = [];
    constructor(eventStore, metrics) {
        this.eventStore = eventStore;
        this.metrics = metrics;
    }
    async scheduleRetry(job, jobId, delayMs) {
        await this.retryQueue.add(`event:${job.eventId}`, job, {
            jobId,
            delay: delayMs,
        });
    }
    onModuleInit() {
        const url = process.env.DELIVERY_URL;
        if (!url) {
            return;
        }
        const processor = new delivery_processor_1.DeliveryProcessor(this.eventStore, this, this.metrics, {
            url,
            secret: process.env.DELIVERY_SECRET ??
                process.env.WEBHOOK_SECRET ??
                'dev-secret',
            maxAttempts: intFromEnv('DELIVERY_MAX_ATTEMPTS', 5),
            backoffBaseMs: intFromEnv('DELIVERY_BACKOFF_MS', 1000),
        });
        const handle = (job) => processor.process(job.data, {
            jobId: job.id ?? '',
            queueLagMs: (job.processedOn ?? Date.now()) -
                (job.timestamp + (job.opts.delay ?? 0)),
        });
        this.workers = [
            new bullmq_1.Worker(bullmq_delivery_queue_1.QUEUE_NAME, handle, {
                connection: this.connection,
                concurrency: intFromEnv('DELIVERY_CONCURRENCY', 10),
            }),
            new bullmq_1.Worker(bullmq_delivery_queue_1.RETRY_QUEUE_NAME, handle, {
                connection: this.connection,
                concurrency: intFromEnv('RETRY_CONCURRENCY', 5),
            }),
        ];
    }
    async onModuleDestroy() {
        await Promise.all(this.workers.map((worker) => worker.close()));
        await this.retryQueue.close();
        await this.connection.quit();
    }
};
exports.BullMqDeliveryWorker = BullMqDeliveryWorker;
exports.BullMqDeliveryWorker = BullMqDeliveryWorker = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object, metrics_service_1.MetricsService])
], BullMqDeliveryWorker);
//# sourceMappingURL=bullmq-delivery.worker.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullMqDeliveryQueue = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const QUEUE_NAME = 'relay-deliveries';
let BullMqDeliveryQueue = class BullMqDeliveryQueue {
    connection = new ioredis_1.default(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    queue = new bullmq_1.Queue(QUEUE_NAME, {
        connection: this.connection,
        defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 1000,
            removeOnFail: false,
        },
    });
    async enqueue(job) {
        await this.queue.add(`event:${job.eventId}`, job, {
            jobId: job.eventId,
        });
    }
    async onModuleDestroy() {
        await this.queue.close();
        await this.connection.quit();
    }
};
exports.BullMqDeliveryQueue = BullMqDeliveryQueue;
exports.BullMqDeliveryQueue = BullMqDeliveryQueue = __decorate([
    (0, common_1.Injectable)()
], BullMqDeliveryQueue);
//# sourceMappingURL=bullmq-delivery.queue.js.map
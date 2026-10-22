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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const event_store_1 = require("./events/event-store");
const delivery_queue_1 = require("./delivery/delivery-queue");
const metrics_service_1 = require("./metrics/metrics.service");
const signature_1 = require("./signature");
let AppService = class AppService {
    eventStore;
    deliveryQueue;
    metrics;
    secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';
    constructor(eventStore, deliveryQueue, metrics) {
        this.eventStore = eventStore;
        this.deliveryQueue = deliveryQueue;
        this.metrics = metrics;
    }
    verifySignature(rawBody, signature) {
        if (!rawBody) {
            return false;
        }
        return (0, signature_1.isValidSignature)(rawBody, signature, this.secret);
    }
    async acceptEvent(event) {
        const isNew = await this.eventStore.saveIfNew(event);
        if (isNew || !(await this.eventStore.hasSuccessfulDelivery(event))) {
            await this.deliveryQueue.enqueue(event);
            await this.eventStore.markEnqueued(event);
        }
        this.metrics.recordEvent(event.source, isNew ? 'new' : 'duplicate');
        return {
            accepted: true,
            duplicate: !isNew,
            eventId: event.eventId,
            status: isNew ? 'received' : 'already_received',
        };
    }
    async retryEvent(key) {
        const event = await this.eventStore.getEvent(key);
        const deadLetter = await this.eventStore.getDeadLetter(key);
        if (!event || !deadLetter) {
            throw new common_1.NotFoundException('Event is not in the dead-letter queue');
        }
        await this.deliveryQueue.enqueue(event, (0, delivery_queue_1.manualRetryJobId)(key.source, key.eventId, Date.now()));
        return {
            source: key.source,
            eventId: key.eventId,
            status: 'queued_for_retry',
        };
    }
    getAttempts(key) {
        return this.eventStore.getAttempts(key);
    }
    async getAttemptsByEventId(eventId) {
        const sources = await this.eventStore.findSources(eventId);
        return sources.length === 0
            ? []
            : this.getAttempts(await this.resolveKey(eventId));
    }
    listDeadLetters() {
        return this.eventStore.listDeadLetters();
    }
    async resolveKey(eventId) {
        const sources = await this.eventStore.findSources(eventId);
        if (sources.length === 0) {
            throw new common_1.NotFoundException(`Event ${eventId} not found`);
        }
        if (sources.length > 1) {
            throw new common_1.ConflictException(`Event id ${eventId} exists for several sources (${sources.join(', ')}); use /events/:source/:eventId`);
        }
        return { source: sources[0], eventId };
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(event_store_1.EVENT_STORE)),
    __param(1, (0, common_1.Inject)(delivery_queue_1.DELIVERY_QUEUE)),
    __metadata("design:paramtypes", [Object, Object, metrics_service_1.MetricsService])
], AppService);
//# sourceMappingURL=app.service.js.map
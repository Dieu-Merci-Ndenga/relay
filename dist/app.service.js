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
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const event_store_1 = require("./events/event-store");
const delivery_queue_1 = require("./delivery/delivery-queue");
let AppService = class AppService {
    eventStore;
    deliveryQueue;
    secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';
    constructor(eventStore, deliveryQueue) {
        this.eventStore = eventStore;
        this.deliveryQueue = deliveryQueue;
    }
    verifySignature(rawBody, signature) {
        if (!rawBody) {
            return false;
        }
        const expected = (0, node_crypto_1.createHmac)('sha256', this.secret)
            .update(rawBody)
            .digest('hex');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        const receivedBuffer = Buffer.from(signature, 'utf8');
        return (expectedBuffer.length === receivedBuffer.length &&
            (0, node_crypto_1.timingSafeEqual)(expectedBuffer, receivedBuffer));
    }
    async acceptEvent(event) {
        const duplicate = !(await this.eventStore.saveIfNew(event));
        if (!duplicate ||
            !(await this.eventStore.hasSuccessfulDelivery(event.eventId))) {
            await this.deliveryQueue.enqueue(event);
        }
        return {
            accepted: true,
            duplicate,
            eventId: event.eventId,
            status: duplicate ? 'already_received' : 'received',
        };
    }
    async retryEvent(eventId) {
        const event = await this.eventStore.getEvent(eventId);
        const deadLetter = await this.eventStore.getDeadLetter(eventId);
        if (!event || !deadLetter) {
            throw new common_1.NotFoundException('Event is not in the dead-letter queue');
        }
        await this.deliveryQueue.enqueue(event, `manual-retry-${eventId}-${Date.now()}`);
        return {
            eventId,
            status: 'queued_for_retry',
        };
    }
    getAttempts(eventId) {
        return this.eventStore.getAttempts(eventId);
    }
    listDeadLetters() {
        return this.eventStore.listDeadLetters();
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(event_store_1.EVENT_STORE)),
    __param(1, (0, common_1.Inject)(delivery_queue_1.DELIVERY_QUEUE)),
    __metadata("design:paramtypes", [Object, Object])
], AppService);
//# sourceMappingURL=app.service.js.map
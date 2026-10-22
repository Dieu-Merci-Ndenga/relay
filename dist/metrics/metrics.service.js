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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const prom_client_1 = require("prom-client");
let MetricsService = class MetricsService {
    registry = new prom_client_1.Registry();
    pendingOutbox;
    eventsReceived = new prom_client_1.Counter({
        name: 'relay_events_received_total',
        help: 'Webhook events accepted, by source and whether they were new or duplicates.',
        labelNames: ['source', 'result'],
        registers: [this.registry],
    });
    deliveryAttempts = new prom_client_1.Counter({
        name: 'relay_delivery_attempts_total',
        help: 'Delivery attempts, by source, kind and outcome.',
        labelNames: ['source', 'kind', 'outcome'],
        registers: [this.registry],
    });
    deliveryDuration = new prom_client_1.Histogram({
        name: 'relay_delivery_duration_seconds',
        help: 'Duration of delivery HTTP calls.',
        labelNames: ['outcome'],
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
        registers: [this.registry],
    });
    queueLag = new prom_client_1.Histogram({
        name: 'relay_delivery_queue_lag_seconds',
        help: 'Time a delivery job waited in the queue after it became eligible.',
        labelNames: ['kind'],
        buckets: [0.01, 0.05, 0.25, 1, 5, 15, 60, 300],
        registers: [this.registry],
    });
    deadLetters = new prom_client_1.Counter({
        name: 'relay_dead_letters_total',
        help: 'Events moved to the dead-letter queue.',
        labelNames: ['source'],
        registers: [this.registry],
    });
    outboxRequeued = new prom_client_1.Counter({
        name: 'relay_outbox_requeued_total',
        help: 'Events re-enqueued by the outbox sweeper.',
        registers: [this.registry],
    });
    constructor() {
        (0, prom_client_1.collectDefaultMetrics)({ register: this.registry });
        const pendingOutbox = () => this.pendingOutbox;
        new prom_client_1.Gauge({
            name: 'relay_outbox_pending_events',
            help: 'Stored events not yet acknowledged as enqueued.',
            registers: [this.registry],
            async collect() {
                const provider = pendingOutbox();
                if (provider) {
                    this.set(await provider());
                }
            },
        });
    }
    get contentType() {
        return this.registry.contentType;
    }
    metrics() {
        return this.registry.metrics();
    }
    onOutboxPending(provider) {
        this.pendingOutbox = provider;
    }
    recordEvent(source, result) {
        this.eventsReceived.inc({ source, result });
    }
    recordAttempt(source, kind, outcome, durationMs) {
        this.deliveryAttempts.inc({ source, kind, outcome });
        this.deliveryDuration.observe({ outcome }, durationMs / 1000);
    }
    recordQueueLag(kind, lagMs) {
        this.queueLag.observe({ kind }, Math.max(lagMs, 0) / 1000);
    }
    recordDeadLetter(source) {
        this.deadLetters.inc({ source });
    }
    recordOutboxRequeued(count) {
        this.outboxRequeued.inc(count);
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const event_store_1 = require("./events/event-store");
const in_memory_event_store_1 = require("./events/in-memory-event.store");
const postgres_event_store_1 = require("./events/postgres-event.store");
const delivery_queue_1 = require("./delivery/delivery-queue");
const in_memory_delivery_queue_1 = require("./delivery/in-memory-delivery.queue");
const bullmq_delivery_queue_1 = require("./delivery/bullmq-delivery.queue");
const bullmq_delivery_worker_1 = require("./delivery/bullmq-delivery.worker");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: event_store_1.EVENT_STORE,
                useFactory: () => process.env.NODE_ENV === 'test'
                    ? new in_memory_event_store_1.InMemoryEventStore()
                    : new postgres_event_store_1.PostgresEventStore(),
            },
            {
                provide: delivery_queue_1.DELIVERY_QUEUE,
                useFactory: () => process.env.NODE_ENV === 'test'
                    ? new in_memory_delivery_queue_1.InMemoryDeliveryQueue()
                    : new bullmq_delivery_queue_1.BullMqDeliveryQueue(),
            },
            {
                provide: delivery_queue_1.DELIVERY_WORKER,
                useFactory: () => process.env.NODE_ENV === 'test' ? null : new bullmq_delivery_worker_1.BullMqDeliveryWorker(),
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
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
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const secrets_1 = require("./config/secrets");
const metrics_service_1 = require("./metrics/metrics.service");
const signature_1 = require("./signature");
let AppController = class AppController {
    appService;
    metrics;
    constructor(appService, metrics) {
        this.appService = appService;
        this.metrics = metrics;
    }
    health() {
        return { status: 'ok' };
    }
    async getMetrics(authorization, response) {
        const token = process.env.METRICS_TOKEN;
        if (token && !(0, signature_1.safeEqual)(authorization ?? '', `Bearer ${token}`)) {
            throw new common_1.UnauthorizedException('Invalid metrics token');
        }
        response.type(this.metrics.contentType);
        return this.metrics.metrics();
    }
    async receiveWebhook(source, eventId, signature, request) {
        if (!eventId) {
            throw new common_1.BadRequestException('x-relay-event-id is required');
        }
        if (!(0, secrets_1.isValidId)(eventId) || !(0, secrets_1.isValidId)(source)) {
            throw new common_1.BadRequestException('source and x-relay-event-id must be 1-128 characters of [A-Za-z0-9_.:@+=-]');
        }
        if (!signature ||
            !this.appService.verifySignature(request.rawBody, signature)) {
            throw new common_1.UnauthorizedException('Invalid webhook signature');
        }
        return this.appService.acceptEvent({
            eventId,
            source,
            payload: request.body,
        });
    }
    getAttempts(source, eventId) {
        return this.appService.getAttempts({ source, eventId });
    }
    retryEvent(source, eventId) {
        return this.appService.retryEvent({ source, eventId });
    }
    getAttemptsByEventId(eventId) {
        return this.appService.getAttemptsByEventId(eventId);
    }
    async retryEventByEventId(eventId) {
        return this.appService.retryEvent(await this.appService.resolveKey(eventId));
    }
    getDeadLetters() {
        return this.appService.listDeadLetters();
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
__decorate([
    (0, common_1.Get)('metrics'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Post)('webhooks/:source'),
    __param(0, (0, common_1.Param)('source')),
    __param(1, (0, common_1.Headers)('x-relay-event-id')),
    __param(2, (0, common_1.Headers)('x-relay-signature')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "receiveWebhook", null);
__decorate([
    (0, common_1.Get)('events/:source/:eventId/attempts'),
    __param(0, (0, common_1.Param)('source')),
    __param(1, (0, common_1.Param)('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getAttempts", null);
__decorate([
    (0, common_1.Post)('events/:source/:eventId/retry'),
    __param(0, (0, common_1.Param)('source')),
    __param(1, (0, common_1.Param)('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "retryEvent", null);
__decorate([
    (0, common_1.Get)('events/:eventId/attempts'),
    __param(0, (0, common_1.Param)('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getAttemptsByEventId", null);
__decorate([
    (0, common_1.Post)('events/:eventId/retry'),
    __param(0, (0, common_1.Param)('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "retryEventByEventId", null);
__decorate([
    (0, common_1.Get)('dead-letters'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getDeadLetters", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        metrics_service_1.MetricsService])
], AppController);
//# sourceMappingURL=app.controller.js.map
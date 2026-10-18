"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
let AppService = class AppService {
    events = new Map();
    secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';
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
    acceptEvent(event) {
        const duplicate = this.events.has(event.eventId);
        if (!duplicate) {
            this.events.set(event.eventId, event);
        }
        return {
            accepted: true,
            duplicate,
            eventId: event.eventId,
            status: duplicate ? 'already_received' : 'received',
        };
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)()
], AppService);
//# sourceMappingURL=app.service.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminGuard = void 0;
const common_1 = require("@nestjs/common");
const secrets_1 = require("./config/secrets");
const signature_1 = require("./signature");
let AdminGuard = class AdminGuard {
    token = (0, secrets_1.adminToken)();
    canActivate(context) {
        if (!this.token) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const header = request.headers.authorization ?? '';
        if (!(0, signature_1.safeEqual)(header, `Bearer ${this.token}`)) {
            throw new common_1.UnauthorizedException('Invalid or missing admin token');
        }
        return true;
    }
};
exports.AdminGuard = AdminGuard;
exports.AdminGuard = AdminGuard = __decorate([
    (0, common_1.Injectable)()
], AdminGuard);
//# sourceMappingURL=admin.guard.js.map
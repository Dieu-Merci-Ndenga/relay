"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookSecret = webhookSecret;
exports.deliverySecret = deliverySecret;
exports.isValidId = isValidId;
exports.adminToken = adminToken;
const DEV_SECRET = 'dev-secret';
function resolve(name, value) {
    if (process.env.NODE_ENV === 'production') {
        if (!value || value === DEV_SECRET) {
            throw new Error(`${name} must be set to a non-default value in production`);
        }
    }
    return value ?? DEV_SECRET;
}
function webhookSecret() {
    return resolve('WEBHOOK_SECRET', process.env.WEBHOOK_SECRET);
}
function deliverySecret() {
    return resolve('DELIVERY_SECRET (or WEBHOOK_SECRET)', process.env.DELIVERY_SECRET ?? process.env.WEBHOOK_SECRET);
}
const ID_PATTERN = /^[\w.:@+=-]{1,128}$/;
function isValidId(value) {
    return ID_PATTERN.test(value);
}
function adminToken() {
    const token = process.env.ADMIN_TOKEN;
    if (process.env.NODE_ENV === 'production' && !token) {
        throw new Error('ADMIN_TOKEN must be set in production');
    }
    return token || undefined;
}
//# sourceMappingURL=secrets.js.map
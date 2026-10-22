"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_WORKER = exports.DELIVERY_QUEUE = void 0;
exports.deliveryJobId = deliveryJobId;
exports.manualRetryJobId = manualRetryJobId;
exports.retryJobId = retryJobId;
exports.DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE');
exports.DELIVERY_WORKER = Symbol('DELIVERY_WORKER');
function encodePart(part) {
    return encodeURIComponent(part).replace(/[^A-Za-z0-9%]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}
function deliveryJobId(source, eventId) {
    return `${encodePart(source)}_${encodePart(eventId)}`;
}
function manualRetryJobId(source, eventId, timestamp) {
    return `manual-retry_${deliveryJobId(source, eventId)}_${timestamp}`;
}
function retryJobId(origin, attempt) {
    return `${origin}_retry-${attempt}`;
}
//# sourceMappingURL=delivery-queue.js.map
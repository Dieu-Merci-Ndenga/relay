"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signPayload = signPayload;
exports.safeEqual = safeEqual;
exports.isValidSignature = isValidSignature;
const node_crypto_1 = require("node:crypto");
function signPayload(body, secret) {
    return (0, node_crypto_1.createHmac)('sha256', secret).update(body).digest('hex');
}
function safeEqual(a, b) {
    const digest = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest();
    return (0, node_crypto_1.timingSafeEqual)(digest(a), digest(b));
}
function isValidSignature(body, signature, secret) {
    return safeEqual(signPayload(body, secret), signature);
}
//# sourceMappingURL=signature.js.map
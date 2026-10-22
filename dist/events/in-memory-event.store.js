"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryEventStore = void 0;
const common_1 = require("@nestjs/common");
const keyOf = ({ source, eventId }) => JSON.stringify([source, eventId]);
let InMemoryEventStore = class InMemoryEventStore {
    events = new Map();
    attempts = [];
    deadLetters = [];
    async saveIfNew(event) {
        const key = keyOf(event);
        if (this.events.has(key)) {
            return false;
        }
        this.events.set(key, { ...event, receivedAt: Date.now() });
        return true;
    }
    async getEvent(key) {
        const stored = this.events.get(keyOf(key));
        return stored
            ? {
                eventId: stored.eventId,
                source: stored.source,
                payload: stored.payload,
            }
            : undefined;
    }
    async findSources(eventId) {
        return [...this.events.values()]
            .filter((event) => event.eventId === eventId)
            .map((event) => event.source);
    }
    async hasSuccessfulDelivery(key) {
        return this.attempts.some((attempt) => keyOf(attempt) === keyOf(key) && attempt.status === 'delivered');
    }
    async markEnqueued(key) {
        const stored = this.events.get(keyOf(key));
        if (stored) {
            stored.enqueuedAt ??= Date.now();
        }
    }
    async listPendingEnqueue(olderThanMs, limit) {
        const cutoff = Date.now() - olderThanMs;
        return [...this.events.values()]
            .filter((event) => !event.enqueuedAt && event.receivedAt <= cutoff)
            .sort((a, b) => a.receivedAt - b.receivedAt)
            .slice(0, limit)
            .map(({ eventId, source, payload }) => ({ eventId, source, payload }));
    }
    async countPendingEnqueue() {
        return [...this.events.values()].filter((event) => !event.enqueuedAt)
            .length;
    }
    async recordAttempt(attempt) {
        this.attempts.push({
            ...attempt,
            createdAt: attempt.createdAt ?? new Date().toISOString(),
        });
    }
    async markDeadLetter(deadLetter) {
        const existingIndex = this.deadLetters.findIndex((item) => keyOf(item) === keyOf(deadLetter));
        if (existingIndex >= 0) {
            this.deadLetters[existingIndex] = deadLetter;
            return;
        }
        this.deadLetters.push(deadLetter);
    }
    async getDeadLetter(key) {
        return this.deadLetters.find((item) => keyOf(item) === keyOf(key));
    }
    async clearDeadLetter(key) {
        const index = this.deadLetters.findIndex((item) => keyOf(item) === keyOf(key));
        if (index >= 0) {
            this.deadLetters.splice(index, 1);
        }
    }
    async getAttempts(key) {
        return this.attempts.filter((attempt) => keyOf(attempt) === keyOf(key));
    }
    async listDeadLetters() {
        return this.deadLetters;
    }
};
exports.InMemoryEventStore = InMemoryEventStore;
exports.InMemoryEventStore = InMemoryEventStore = __decorate([
    (0, common_1.Injectable)()
], InMemoryEventStore);
//# sourceMappingURL=in-memory-event.store.js.map
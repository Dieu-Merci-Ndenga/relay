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
let InMemoryEventStore = class InMemoryEventStore {
    events = new Map();
    attempts = [];
    deadLetters = [];
    async saveIfNew(event) {
        if (this.events.has(event.eventId)) {
            return false;
        }
        this.events.set(event.eventId, event);
        return true;
    }
    async getEvent(eventId) {
        return this.events.get(eventId);
    }
    async recordAttempt(attempt) {
        this.attempts.push({
            ...attempt,
            createdAt: attempt.createdAt ?? new Date().toISOString(),
        });
    }
    async markDeadLetter(deadLetter) {
        const existingIndex = this.deadLetters.findIndex((item) => item.eventId === deadLetter.eventId);
        if (existingIndex >= 0) {
            this.deadLetters[existingIndex] = deadLetter;
            return;
        }
        this.deadLetters.push(deadLetter);
    }
    async getDeadLetter(eventId) {
        return this.deadLetters.find((item) => item.eventId === eventId);
    }
    async clearDeadLetter(eventId) {
        const index = this.deadLetters.findIndex((item) => item.eventId === eventId);
        if (index >= 0) {
            this.deadLetters.splice(index, 1);
        }
    }
    async getAttempts(eventId) {
        return this.attempts.filter((attempt) => attempt.eventId === eventId);
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
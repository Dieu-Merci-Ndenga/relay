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
    events = new Set();
    attempts = [];
    deadLetters = [];
    async saveIfNew(event) {
        if (this.events.has(event.eventId)) {
            return false;
        }
        this.events.add(event.eventId);
        return true;
    }
    async recordAttempt(attempt) {
        this.attempts.push(attempt);
    }
    async markDeadLetter(deadLetter) {
        this.deadLetters.push(deadLetter);
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
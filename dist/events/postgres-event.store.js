"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresEventStore = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
let PostgresEventStore = class PostgresEventStore {
    pool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL ??
            'postgresql://relay:relay@localhost:5432/relay',
    });
    schemaReady;
    async saveIfNew(event) {
        await this.ensureSchema();
        const result = await this.pool.query(`
        INSERT INTO webhook_events (event_id, source, payload)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `, [event.eventId, event.source, JSON.stringify(event.payload)]);
        return result.rowCount === 1;
    }
    async recordAttempt(attempt) {
        await this.ensureSchema();
        await this.pool.query(`
        INSERT INTO delivery_attempts
          (event_id, attempt_number, status, http_status, error, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
            attempt.eventId,
            attempt.attemptNumber,
            attempt.status,
            attempt.httpStatus ?? null,
            attempt.error ?? null,
            attempt.durationMs,
        ]);
    }
    async getEvent(eventId) {
        await this.ensureSchema();
        const result = await this.pool.query('SELECT event_id, source, payload FROM webhook_events WHERE event_id = $1', [eventId]);
        const row = result.rows[0];
        return row
            ? { eventId: row.event_id, source: row.source, payload: row.payload }
            : undefined;
    }
    async markDeadLetter(deadLetter) {
        await this.ensureSchema();
        await this.pool.query(`
        INSERT INTO dead_letters (event_id, reason)
        VALUES ($1, $2)
        ON CONFLICT (event_id) DO UPDATE SET reason = EXCLUDED.reason
      `, [deadLetter.eventId, deadLetter.reason]);
    }
    async getDeadLetter(eventId) {
        await this.ensureSchema();
        const result = await this.pool.query('SELECT event_id, reason FROM dead_letters WHERE event_id = $1', [eventId]);
        const row = result.rows[0];
        return row ? { eventId: row.event_id, reason: row.reason } : undefined;
    }
    async clearDeadLetter(eventId) {
        await this.ensureSchema();
        await this.pool.query('DELETE FROM dead_letters WHERE event_id = $1', [
            eventId,
        ]);
    }
    async getAttempts(eventId) {
        await this.ensureSchema();
        const result = await this.pool.query(`
        SELECT event_id, attempt_number, status, http_status, error, duration_ms, created_at
        FROM delivery_attempts
        WHERE event_id = $1
        ORDER BY created_at ASC, id ASC
      `, [eventId]);
        return result.rows.map((row) => ({
            eventId: row.event_id,
            attemptNumber: row.attempt_number,
            status: row.status,
            httpStatus: row.http_status ?? undefined,
            error: row.error ?? undefined,
            durationMs: row.duration_ms,
            createdAt: row.created_at.toISOString(),
        }));
    }
    async listDeadLetters() {
        await this.ensureSchema();
        const result = await this.pool.query('SELECT event_id, reason FROM dead_letters ORDER BY failed_at DESC');
        return result.rows.map((row) => ({
            eventId: row.event_id,
            reason: row.reason,
        }));
    }
    async onModuleDestroy() {
        await this.pool.end();
    }
    ensureSchema() {
        this.schemaReady ??= this.pool
            .query(`
        CREATE TABLE IF NOT EXISTS webhook_events (
          event_id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          payload JSONB NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS delivery_attempts (
          id BIGSERIAL PRIMARY KEY,
          event_id TEXT NOT NULL REFERENCES webhook_events(event_id),
          attempt_number INTEGER NOT NULL,
          status TEXT NOT NULL,
          http_status INTEGER,
          error TEXT,
          duration_ms INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS dead_letters (
          event_id TEXT PRIMARY KEY REFERENCES webhook_events(event_id),
          reason TEXT NOT NULL,
          failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
            .then(() => undefined);
        return this.schemaReady;
    }
};
exports.PostgresEventStore = PostgresEventStore;
exports.PostgresEventStore = PostgresEventStore = __decorate([
    (0, common_1.Injectable)()
], PostgresEventStore);
//# sourceMappingURL=postgres-event.store.js.map
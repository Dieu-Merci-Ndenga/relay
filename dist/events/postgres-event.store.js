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
        ON CONFLICT (source, event_id) DO NOTHING
        RETURNING event_id
      `, [event.eventId, event.source, JSON.stringify(event.payload)]);
        return result.rowCount === 1;
    }
    async findSources(eventId) {
        await this.ensureSchema();
        const result = await this.pool.query('SELECT source FROM webhook_events WHERE event_id = $1 ORDER BY source', [eventId]);
        return result.rows.map((row) => row.source);
    }
    async hasSuccessfulDelivery(key) {
        await this.ensureSchema();
        const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM delivery_attempts
          WHERE source = $1 AND event_id = $2 AND status = 'delivered'
        ) AS delivered
      `, [key.source, key.eventId]);
        return result.rows[0].delivered;
    }
    async markEnqueued(key) {
        await this.ensureSchema();
        await this.pool.query(`
        UPDATE webhook_events SET enqueued_at = NOW()
        WHERE source = $1 AND event_id = $2 AND enqueued_at IS NULL
      `, [key.source, key.eventId]);
    }
    async listPendingEnqueue(olderThanMs, limit) {
        await this.ensureSchema();
        const result = await this.pool.query(`
        SELECT event_id, source, payload
        FROM webhook_events
        WHERE enqueued_at IS NULL
          AND received_at <= NOW() - ($1 * INTERVAL '1 millisecond')
        ORDER BY received_at ASC
        LIMIT $2
      `, [olderThanMs, limit]);
        return result.rows.map((row) => ({
            eventId: row.event_id,
            source: row.source,
            payload: row.payload,
        }));
    }
    async countPendingEnqueue() {
        await this.ensureSchema();
        const result = await this.pool.query('SELECT COUNT(*)::int AS pending FROM webhook_events WHERE enqueued_at IS NULL');
        return result.rows[0].pending;
    }
    async recordAttempt(attempt) {
        await this.ensureSchema();
        await this.pool.query(`
        INSERT INTO delivery_attempts
          (source, event_id, attempt_number, status, http_status, error, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
            attempt.source,
            attempt.eventId,
            attempt.attemptNumber,
            attempt.status,
            attempt.httpStatus ?? null,
            attempt.error ?? null,
            attempt.durationMs,
        ]);
    }
    async getEvent(key) {
        await this.ensureSchema();
        const result = await this.pool.query('SELECT event_id, source, payload FROM webhook_events WHERE source = $1 AND event_id = $2', [key.source, key.eventId]);
        const row = result.rows[0];
        return row
            ? { eventId: row.event_id, source: row.source, payload: row.payload }
            : undefined;
    }
    async markDeadLetter(deadLetter) {
        await this.ensureSchema();
        await this.pool.query(`
        INSERT INTO dead_letters (source, event_id, reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (source, event_id) DO UPDATE SET reason = EXCLUDED.reason
      `, [deadLetter.source, deadLetter.eventId, deadLetter.reason]);
    }
    async getDeadLetter(key) {
        await this.ensureSchema();
        const result = await this.pool.query('SELECT source, event_id, reason FROM dead_letters WHERE source = $1 AND event_id = $2', [key.source, key.eventId]);
        const row = result.rows[0];
        return row
            ? { source: row.source, eventId: row.event_id, reason: row.reason }
            : undefined;
    }
    async clearDeadLetter(key) {
        await this.ensureSchema();
        await this.pool.query('DELETE FROM dead_letters WHERE source = $1 AND event_id = $2', [key.source, key.eventId]);
    }
    async getAttempts(key) {
        await this.ensureSchema();
        const result = await this.pool.query(`
        SELECT source, event_id, attempt_number, status, http_status, error, duration_ms, created_at
        FROM delivery_attempts
        WHERE source = $1 AND event_id = $2
        ORDER BY created_at ASC, id ASC
      `, [key.source, key.eventId]);
        return result.rows.map((row) => ({
            source: row.source,
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
        const result = await this.pool.query('SELECT source, event_id, reason FROM dead_letters ORDER BY failed_at DESC');
        return result.rows.map((row) => ({
            source: row.source,
            eventId: row.event_id,
            reason: row.reason,
        }));
    }
    async onModuleDestroy() {
        await this.pool.end();
    }
    ensureSchema() {
        this.schemaReady ??= this.migrateSchema().catch((error) => {
            this.schemaReady = undefined;
            throw error;
        });
        return this.schemaReady;
    }
    async migrateSchema() {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(727274)');
            await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_events (
          source TEXT NOT NULL,
          event_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          enqueued_at TIMESTAMPTZ,
          PRIMARY KEY (source, event_id)
        );

        CREATE TABLE IF NOT EXISTS delivery_attempts (
          id BIGSERIAL PRIMARY KEY,
          source TEXT NOT NULL,
          event_id TEXT NOT NULL,
          attempt_number INTEGER NOT NULL,
          status TEXT NOT NULL,
          http_status INTEGER,
          error TEXT,
          duration_ms INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          FOREIGN KEY (source, event_id) REFERENCES webhook_events(source, event_id)
        );

        CREATE TABLE IF NOT EXISTS dead_letters (
          source TEXT NOT NULL,
          event_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (source, event_id),
          FOREIGN KEY (source, event_id) REFERENCES webhook_events(source, event_id)
        );

        DO $$
        BEGIN
          -- Outbox: events stored before this column existed were already
          -- handled, so they must not be re-enqueued by the sweeper.
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'webhook_events' AND column_name = 'enqueued_at'
          ) THEN
            ALTER TABLE webhook_events ADD COLUMN enqueued_at TIMESTAMPTZ;
            UPDATE webhook_events SET enqueued_at = received_at;
          END IF;

          -- Events keyed by event_id alone become keyed by (source, event_id).
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'delivery_attempts' AND column_name = 'source'
          ) THEN
            ALTER TABLE delivery_attempts ADD COLUMN source TEXT;
            UPDATE delivery_attempts a SET source = e.source
              FROM webhook_events e WHERE e.event_id = a.event_id;
            ALTER TABLE delivery_attempts ALTER COLUMN source SET NOT NULL;

            ALTER TABLE dead_letters ADD COLUMN source TEXT;
            UPDATE dead_letters d SET source = e.source
              FROM webhook_events e WHERE e.event_id = d.event_id;
            ALTER TABLE dead_letters ALTER COLUMN source SET NOT NULL;

            ALTER TABLE delivery_attempts DROP CONSTRAINT delivery_attempts_event_id_fkey;
            ALTER TABLE dead_letters DROP CONSTRAINT dead_letters_event_id_fkey;
            ALTER TABLE dead_letters DROP CONSTRAINT dead_letters_pkey;
            ALTER TABLE webhook_events DROP CONSTRAINT webhook_events_pkey;

            ALTER TABLE webhook_events ADD PRIMARY KEY (source, event_id);
            ALTER TABLE dead_letters ADD PRIMARY KEY (source, event_id);
            ALTER TABLE delivery_attempts ADD FOREIGN KEY (source, event_id)
              REFERENCES webhook_events(source, event_id);
            ALTER TABLE dead_letters ADD FOREIGN KEY (source, event_id)
              REFERENCES webhook_events(source, event_id);
          END IF;
        END
        $$;

        CREATE INDEX IF NOT EXISTS webhook_events_pending_idx
          ON webhook_events (received_at) WHERE enqueued_at IS NULL;
        CREATE INDEX IF NOT EXISTS delivery_attempts_event_idx
          ON delivery_attempts (source, event_id);
        CREATE INDEX IF NOT EXISTS webhook_events_event_id_idx
          ON webhook_events (event_id);
      `);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK').catch(() => undefined);
            throw error;
        }
        finally {
            client.release();
        }
    }
};
exports.PostgresEventStore = PostgresEventStore;
exports.PostgresEventStore = PostgresEventStore = __decorate([
    (0, common_1.Injectable)()
], PostgresEventStore);
//# sourceMappingURL=postgres-event.store.js.map
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
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { EventStore, WebhookEvent } from './event-store';

@Injectable()
export class PostgresEventStore implements EventStore, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://relay:relay@localhost:5432/relay',
  });
  private schemaReady?: Promise<void>;

  async saveIfNew(event: WebhookEvent): Promise<boolean> {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        INSERT INTO webhook_events (event_id, source, payload)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `,
      [event.eventId, event.source, JSON.stringify(event.payload)],
    );

    return result.rowCount === 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private ensureSchema(): Promise<void> {
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
}
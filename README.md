# Relay

**Webhook reliability platform for resilient event delivery.**

Relay accepts signed webhook events, persists them safely, delivers them asynchronously, retries transient failures with exponential backoff, and prevents duplicate business effects through idempotency.

## Live Deployment

- **API:** [https://relay-api-brv0.onrender.com](https://relay-api-brv0.onrender.com)
- **Health check:** [https://relay-api-brv0.onrender.com/health](https://relay-api-brv0.onrender.com/health)
- **Console:** [https://relay-dashboard-nrqs.onrender.com](https://relay-dashboard-nrqs.onrender.com/)

## Why Relay Exists

Webhook providers can deliver the same event more than once, while downstream systems may be temporarily unavailable. A reliable consumer must acknowledge events safely, avoid blocking the incoming request on downstream availability, retry transient failures, preserve an auditable history, and provide an operational recovery path.

Relay is designed around **at-least-once delivery** and explicit idempotency. Exactly-once delivery cannot be guaranteed across a database, a queue, and an external HTTP service, so Relay makes repeated delivery safe instead.

## Core Capabilities

- HMAC-SHA256 signature validation using the raw request body.
- Persistent event storage in PostgreSQL.
- Idempotent event ingestion with a unique external event ID.
- Asynchronous delivery through Redis and BullMQ.
- Exponential backoff with up to five delivery attempts.
- Delivery history including status, HTTP status, error, duration, and timestamp.
- Dead-letter queue after the retry policy is exhausted.
- Manual retry for dead-lettered events.
- Graceful recovery when the downstream receiver becomes available again.
- Automated unit, end-to-end, and real-world failure/recovery demonstrations.

## Architecture

```text
Webhook provider
	|
	|  signed HTTP request
	v
NestJS API ------> PostgreSQL
	|
	|  idempotent enqueue
	v
Redis / BullMQ ------> Delivery worker ------> Downstream receiver
	|                      |
	| retries              | attempts, errors, durations
	v                      v
  delayed jobs          PostgreSQL history / DLQ
```

### Project Stack

| Technology | Role |
| --- | --- |
| TypeScript | Type-safe application and domain code |
| NestJS | HTTP API, dependency injection, and application modules |
| PostgreSQL | Durable event, attempt, and dead-letter storage |
| Redis | Fast queue backend and distributed job coordination |
| BullMQ | Asynchronous delivery, retries, and exponential backoff |
| Docker | Reproducible local infrastructure with PostgreSQL and Redis |

The project is deployed through a Render Blueprint defined in [render.yaml](render.yaml).

## API

### Receive an event

```text
POST /webhooks/:source
```

Required headers:

```text
x-relay-event-id: evt_123
x-relay-signature: <HMAC-SHA256 hex digest>
```

### Inspect delivery attempts

```text
GET /events/:eventId/attempts
```

### Inspect the dead-letter queue

```text
GET /dead-letters
```

### Retry a dead-lettered event

```text
POST /events/:eventId/retry
```

### Health check

```text
GET /health
```

## Frontend console

Une console frontend autonome est disponible dans [`frontend/`](frontend/). Elle
propose une vue de supervision responsive pour les événements, les endpoints et
les dead letters, sans modifier la logique backend.

La console en ligne est accessible ici :
[relay-dashboard-nrqs.onrender.com](https://relay-dashboard-nrqs.onrender.com/).

Pour la prévisualiser localement, démarrez l’API puis servez le dossier avec
n’importe quel serveur statique (par exemple `npx serve frontend`). Par défaut,
elle appelle l’API sur la même origine. Si elle est servie sur une autre origine,
précisez l’URL de l’API avec le paramètre `?api=https://relay-api.example.com`
(l’API devra autoriser cette origine via CORS). La console utilise uniquement les
endpoints existants `/health`, `/dead-letters`, `/events/:eventId/attempts` et
`/events/:eventId/retry`.

## Local Development

Requirements: Node.js, npm, and Docker.

```bash
npm install
docker compose up -d
npm run start:dev
```

The default local configuration is documented in [.env.example](.env.example). PostgreSQL creates the required tables when the first event is received.

## Example Request

The signature must be calculated from the exact raw request body.

```bash
BODY='{"event":"payment.created","amount":4200}'
SIGNATURE=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac dev-secret -hex | sed 's/^.* //')

curl -i http://localhost:3000/webhooks/stripe \
  -H 'content-type: application/json' \
  -H 'x-relay-event-id: evt_123' \
  -H "x-relay-signature: $SIGNATURE" \
  --data "$BODY"
```

## Reliability Demonstration

The repository includes a controllable receiver and a reproducible failure/recovery scenario:

```bash
# Terminal 1
npm run demo:receiver

# Terminal 2
DELIVERY_URL=http://localhost:4000/webhook-receiver npm run start:dev

# Terminal 3
REPORT_FILE=./demo/report.json npm run demo:scenario
```

The scenario sends five events and duplicates each request while the receiver is unavailable. It then restores the receiver and verifies retries, eventual delivery, and one business effect per event.

Measured run:

```text
Events: 5
Submitted requests: 10
Duplicate requests detected: 5
Total delivery attempts: 15
Failed attempts: 10
Successful deliveries: 5
Business effects applied: 5
```

The demo receiver is intentionally open for failure simulation and is not intended for production use without authentication and access control.

## Tests and Build

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

## Deployment on Render

[render.yaml](render.yaml) defines the API service, the frontend static site,
the demo receiver, PostgreSQL, and Redis. Render provides `PORT`,
`DATABASE_URL`, and `REDIS_URL` through the Blueprint.

Set these secret or service-specific values in Render:

```text
WEBHOOK_SECRET=<long random secret>
DELIVERY_URL=https://<receiver-service>.onrender.com/webhook-receiver
FRONTEND_URL=https://<dashboard-service>.onrender.com
```

The receiver URL must be public. `localhost` cannot be used from a deployed Render service.
After deployment, open the dashboard URL with the API URL configured:

```text
https://<dashboard-service>.onrender.com/?api=https://<api-service>.onrender.com
```

`FRONTEND_URL` must match the dashboard origin exactly (without a trailing slash)
so that the browser can call the API. For a custom frontend domain, use that
domain instead. The backend keeps CORS disabled when `FRONTEND_URL` is unset.


---

<p align="center">
  <img src="/frontend/img/relay_OpenGraph_banner.png" alt="Relay - Event-Driven Webhook Engine" width="100%">
</p>


# Security Policy

## Supported Versions

Security fixes are prioritized for the latest version on the `main` branch. Older versions are not guaranteed support.

## Reporting a Vulnerability

Please report vulnerabilities responsibly. **Do not open a public issue, pull request or discussion for an exploitable vulnerability.**

Use GitHub's private vulnerability reporting for this repository (**Security → Report a vulnerability**), or contact the maintainer privately through the contact information on their GitHub profile. Include:

- A description of the issue and its impact.
- Steps or a minimal proof of concept to reproduce it safely.
- The affected component, endpoint or configuration, and the version or commit.
- Relevant logs or requests with sensitive information removed.

Do not include real credentials, production secrets or personal data. Relay is maintained on a best-effort basis: you can expect an acknowledgement within a few days, but no fixed resolution time is guaranteed. Please allow reasonable time for a fix before any public disclosure.

## Scope

In scope: the NestJS API, webhook signature validation, idempotency and delivery logic, operator routes, the outbox and queue processing, the Docker and Render configuration, and the static console in `frontend/`.

Out of scope: vulnerabilities in third-party services or dependencies without a demonstrated impact on Relay, the intentionally open demo receiver (`demo/receiver.mjs`), social engineering, and load or destructive testing against public deployments without prior authorization.

## Security Model

- **Inbound authentication:** every webhook carries an HMAC-SHA256 signature computed over the raw request body, compared in constant time. `source` and `x-relay-event-id` are validated (1-128 characters of `[A-Za-z0-9_.:@+=-]`) before reaching the database, queue or logs.
- **Idempotency:** event ids are unique per source, so replays never create a second business effect. Delivery is at-least-once; receivers should deduplicate on `x-relay-event-id` and `x-relay-source`.
- **Outbound delivery:** every delivery is signed with `DELIVERY_SECRET` (falling back to `WEBHOOK_SECRET`), has a timeout (`DELIVERY_TIMEOUT_MS`) and never follows redirects, so a receiver cannot stall a worker or bounce a signed payload to another host.
- **Operator routes:** `/dead-letters` and `/events/...` (attempts and retry) require `Authorization: Bearer <ADMIN_TOKEN>`. The token is compared in constant time and is **mandatory** in production: the API refuses to start without it. When unset in development, these routes stay open.
- **Metrics:** `/metrics` is protected by `METRICS_TOKEN` when set.
- **Production configuration:** with `NODE_ENV=production`, the API refuses to start if `WEBHOOK_SECRET` or `DELIVERY_SECRET` is missing or equals the development default.
- **Headers and CORS:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Cache-Control: no-store` are set, and `X-Powered-By` is removed. CORS is disabled unless `FRONTEND_URL` is set; use exact origins (comma-separated) rather than wildcards.
- **Console:** the dashboard keeps the admin token in `sessionStorage`, which any script running on that origin can read, and clears it when the tab closes.
- **Dependencies:** `npm audit --omit=dev --audit-level=high` runs in CI.

## Deployment Responsibilities

Operators should:

- Store secrets in environment variables or a secret manager, and never commit credentials.
- Use long, randomly generated values for `WEBHOOK_SECRET`, `DELIVERY_SECRET` and `ADMIN_TOKEN`.
- Restrict PostgreSQL and Redis access to trusted services.
- Serve the API and the downstream receiver over HTTPS.
- Avoid logging secrets or unnecessarily exposing webhook payloads.
- Keep dependencies and runtime environments up to date.

The local Docker Compose file and the demo receiver use simplified settings and must not be assumed safe for production.

## Known Limitations

Operator access is a single shared bearer token without roles or users, and Relay is single-tenant. These are documented design limits; see the _Limitations_ section of the [README](README.md#limitations).

## Disclosure

Once a vulnerability has been investigated and a fix or mitigation is available, the maintainer may publish a security advisory describing the issue, its impact and the recommended upgrade or mitigation.

This policy is not a guarantee that Relay is free of vulnerabilities or suitable for every production environment.

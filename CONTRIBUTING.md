# Contributing to Relay

Thank you for your interest in contributing to Relay, a webhook reliability platform built with NestJS, PostgreSQL, Redis and BullMQ. Its priorities are correctness, observability and recoverable asynchronous delivery. By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to Contribute

- Bug reports with a reproducible failure.
- Reliability, concurrency and failure-recovery improvements.
- Security hardening (see [Security](#security)).
- Unit, end-to-end and integration tests.
- Documentation improvements.

## Reporting Issues

Search existing issues first. Please include the expected and actual behavior, steps to reproduce, relevant logs or test output, and your environment (Node.js, PostgreSQL and Redis versions). Remove secrets, tokens and personal data from everything you share.

## Development Setup

Requirements: Node.js 22 or later, npm and Docker.

```bash
git clone https://github.com/Dieu-Merci-Ndenga/relay.git
cd relay
npm ci
docker compose up -d      # PostgreSQL and Redis
npm run start:dev
```

See the [README](README.md#local-development) for configuration and a signed example request. Configuration is read from environment variables; [.env.example](.env.example) lists them with their defaults.

## Checks

Run these before opening a pull request. The same checks run in [CI](.github/workflows/ci.yml).

```bash
npm run lint
npm run format:check
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:integration   # requires Docker; run it when persistence, queues or the outbox change
npm run build
```

## Pull Requests

1. Fork the repository and create a focused branch from `main`.
2. Keep each pull request small and on a single topic.
3. Add or update tests; bug fixes should include a regression test where practical.
4. Preserve existing behavior unless the change explicitly requires otherwise, and document reliability or architectural trade-offs.
5. Fill in the pull request template with the motivation, the tests you ran and any check you could not run.

For significant architectural changes, open an issue first to agree on the approach.

Never commit secrets, credentials, `.env` files or build output (`dist/`).

## Security

Do not disclose exploitable vulnerabilities in public issues or pull requests. Follow the private reporting process in [SECURITY.md](SECURITY.md).

## Project Scope

Relay focuses on reliable asynchronous webhook delivery: signature validation, idempotent processing, retries, dead-letter recovery and operational observability. Changes outside this scope, such as multi-tenancy or per-endpoint subscriptions, are listed as known limitations in the README and should be discussed in an issue first.

## License

By submitting a contribution, you agree that it will be distributed under the [MIT License](LICENSE) that covers this project.

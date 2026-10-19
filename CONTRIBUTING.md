
# Contributing to Relay

Thank you for your interest in contributing to Relay.

Relay is an open-source webhook reliability platform built with NestJS, PostgreSQL, Redis, and BullMQ. Its primary goals are correctness, observability, and recoverable asynchronous event delivery.

## Ways to Contribute

Contributions are welcome in the following areas:

- Bug reports and reproducible failures.
- Architecture reviews and reliability improvements.
- Security and concurrency edge cases.
- Unit tests, end-to-end tests, and failure-recovery scenarios.
- Documentation improvements.
- Focused pull requests.

## Reporting Issues

Before opening an issue, please check whether a similar report already exists.

Include the following information whenever possible:

- Expected behavior.
- Actual behavior.
- Steps to reproduce the problem.
- Relevant logs or test output.
- Environment details, including relevant runtime or dependency versions.

Remove secrets, credentials, tokens, and personal data from all logs and examples.

## Development and Testing

1. Fork the repository and create a focused branch.
2. Install dependencies and start the required local services using the documented setup.
3. Add or update tests for your changes.
4. Run the relevant checks:

   ```bash
   npm test -- --runInBand
   npm run test:e2e -- --runInBand
   npm run build
   ```

5. Open a pull request describing the change, its motivation, the tests performed, and any relevant trade-offs.

Use the repository's documented commands and configuration. If a check cannot be run, explain why in the pull request.

## Pull Request Guidelines

- Keep changes focused and easy to review.
- Preserve existing behavior unless the change explicitly requires otherwise.
- Include regression tests for bug fixes where practical.
- Document architectural changes and reliability trade-offs.
- Do not introduce secrets, credentials, or unrelated changes.

For significant architectural changes, open an issue first to discuss the proposed approach.

## Security

Please do not disclose exploitable vulnerabilities in public issues.

Use the repository's private vulnerability reporting mechanism, if enabled, or contact the maintainer privately. Include enough information to reproduce the issue safely without exposing real credentials or sensitive data.

See `SECURITY.md` for the project's security reporting procedure, when available.

## Project Scope

Relay focuses on reliable asynchronous webhook delivery, idempotent processing, retry handling, dead-letter recovery, and operational observability.

Contributions should support these goals and include appropriate tests when they affect reliability or correctness.

## License

By submitting a contribution, you agree that your contribution will be distributed under the MIT License that applies to this project.

Thank you for helping make Relay more reliable.

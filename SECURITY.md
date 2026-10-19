
# Security Policy

## Supported Versions

Security fixes are generally prioritized for the latest version of Relay available on the `main` branch.

As Relay is an actively developed open-source project, support for older versions is not guaranteed.

## Reporting a Vulnerability

If you discover a security vulnerability in Relay, please report it responsibly.

**Do not disclose exploitable vulnerabilities in public GitHub issues, pull requests, or discussions.**

### Preferred Reporting Method

If GitHub Private Vulnerability Reporting is enabled for this repository:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability**.
3. Provide the details needed to understand and reproduce the issue safely.

If private vulnerability reporting is unavailable, contact the repository maintainer privately through the contact information listed on their GitHub profile.

Do not include credentials, production secrets, personal data, or sensitive customer information in your report.

### What to Include

Please provide, where possible:

- A description of the vulnerability and its potential impact.
- The affected component, endpoint, or configuration.
- Steps to reproduce the issue.
- A minimal proof of concept that does not compromise real systems or data.
- Relevant logs, request examples, or test results with sensitive information removed.
- Suggested mitigations, if known.

### What to Expect

The maintainer will review the report and may request additional information to assess its severity and reproducibility.

Please allow reasonable time for investigation and remediation before publicly disclosing the vulnerability.

Relay is an open-source project maintained on a best-effort basis. A response or fix within a specific timeframe is not guaranteed.

## Security Scope

Security reports relevant to Relay may include:

- Webhook signature validation and request tampering.
- Replay attacks and weaknesses in event authentication.
- Idempotency bypasses and duplicate business effects.
- Unauthorized access to event data, delivery history, or dead-letter operations.
- Unsafe manual retry or administrative operations.
- Injection vulnerabilities and improper input validation.
- Exposure of secrets, credentials, or sensitive event payloads.
- Insecure CORS configuration or unintended public access to internal functionality.
- Queue processing, concurrency, and recovery flaws with security implications.
- Dependency vulnerabilities that materially affect Relay.

## Out of Scope

The following are generally outside the scope of security reports unless they demonstrate a concrete security impact:

- Vulnerabilities in third-party services outside Relay's control.
- Issues affecting unsupported or intentionally insecure local demonstration configurations.
- Reports based solely on outdated dependency versions without a demonstrated impact.
- Denial-of-service testing against public deployments without prior authorization.
- Social engineering, phishing, or physical attacks against maintainers or infrastructure providers.

Public deployments must not be used for destructive testing, unauthorized access attempts, or load testing without explicit permission.

## Deployment and Configuration Responsibilities

Relay integrates with external infrastructure, including PostgreSQL, Redis, and downstream HTTP receivers. Secure deployment depends on correct configuration.

Operators should:

- Store secrets in environment variables or a dedicated secret manager.
- Never commit production credentials or private keys.
- Use strong, randomly generated webhook secrets.
- Restrict database and Redis access to trusted services.
- Configure CORS for explicitly trusted frontend origins.
- Protect administrative and retry operations with appropriate authentication and authorization.
- Use HTTPS for public endpoints and downstream delivery.
- Avoid logging secrets or unnecessarily exposing sensitive webhook payloads.
- Keep dependencies and deployment environments updated.

Local demonstration components may intentionally use simplified security settings. They must not be assumed safe for production without additional controls.

## Disclosure

Please coordinate public disclosure with the maintainer whenever possible.

Once a vulnerability has been investigated and a fix or mitigation is available, the maintainer may publish a security advisory describing the issue, its impact, and the recommended upgrade or mitigation.

## Limitations

Relay is an open-source engineering project. Security reviews, fixes, and responses are provided on a best-effort basis.

The existence of this policy does not constitute a guarantee that Relay is free of vulnerabilities or suitable for every production environment.

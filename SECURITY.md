# Security Policy

## Reporting a vulnerability

**Please do not open public GitHub issues for security problems.**

Report vulnerabilities privately through either:

- [GitHub Security Advisories](https://github.com/Ignitic-AI/ignitic/security/advisories/new) (preferred), or
- Email **igniticai@gmail.com** with the subject `SECURITY: <short summary>`.

Include as much of the following as you can:

- Affected app (`backend`, `frontend`, `ai-engine`, `mcp`) and commit or version
- Description of the issue and its impact
- Steps to reproduce or a proof of concept
- Any suggested fix

## What to expect

| Step | Target |
|------|--------|
| Acknowledgement | within 3 business days |
| Initial assessment | within 7 business days |
| Fix or mitigation plan | depends on severity; critical issues are prioritized |

We will keep you informed, credit you in the release notes if you wish, and coordinate a disclosure date with you. Please give us a reasonable window to ship a fix before disclosing publicly.

## Supported versions

Security fixes land on `main` and in the latest release. Older releases are not patched.

## Scope

In scope: code in this repository, the default `docker-compose.yml`, and the published container images.

Out of scope: third-party integrations' own vulnerabilities (report those upstream), findings that require a compromised host or leaked credentials, and deployments that ignore the hardening notes below.

## Hardening self-hosted deployments

The defaults in `.env.example` are for local development. Before exposing an instance:

- Generate fresh values for `JWT_SECRET`, `ENCRYPTION_KEY`, `PASS_ENCRYPTION_FERNET_KEY`, `NEXTAUTH_SECRET` and every database password.
- Keep PostgreSQL, MongoDB, Redis, RabbitMQ and Neo4j off the public internet.
- Put the frontend and backend behind TLS.
- Set `ENVIRONMENT=production` and restrict `CORS_ALLOWED_ORIGINS` to your own domain.

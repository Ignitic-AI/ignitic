<div align="center">

<img src="docs/assets/banner.svg" alt="Ignitic — the future of e-commerce automation" width="720">

<br/>

<img src="docs/assets/logo.png" alt="" width="48">

# Ignitic

**Open-source, real-time AI agents that run your e-commerce operations.**

Specialist agents for sales, marketing, support, ads and analytics — 190+ MCP tools across 15 domains, long-term memory, and team workspaces — behind one platform you self-host.

[![CI](https://github.com/Ignitic-AI/ignitic/actions/workflows/ci.yml/badge.svg)](https://github.com/Ignitic-AI/ignitic/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0%20%2B%20conditions-blue)](LICENSE)
[![Docker Compose](https://img.shields.io/badge/self--host-docker%20compose-2496ED?logo=docker&logoColor=white)](#quick-start)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quick start](#quick-start) · [Agents](#specialist-agents) · [Integrations](#integrations) · [Architecture](#architecture) · [MCP tools](apps/mcp/README.md) · [Contributing](CONTRIBUTING.md)

</div>

---

## Contents

- [Why Ignitic](#why-ignitic)
- [Specialist agents](#specialist-agents)
- [Integrations](#integrations)
- [Features](#features)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [FAQ](#faq)
- [Status](#status)
- [Contributing](#contributing)
- [License](#license)

## Why Ignitic

Running an e-commerce store means juggling a dozen surfaces at once — the store, ad accounts, CRM, inbox, socials, analytics. Each one has its own dashboard, its own API, its own quirks. Wiring an AI agent to all of them by hand means a dozen different SDKs, a dozen different auth flows, and rewriting the same tool-calling glue every time a new integration shows up.

Ignitic is that glue, already built. A **super-agent** on your team's chat delegates to specialist agents — a business analyst, a marketer, a Shopify agent, a customer-support agent — each backed by real tools served over the [Model Context Protocol](https://modelcontextprotocol.io). Agents stream their work in real time, remember context across conversations via checkpointed and knowledge-graph memory, and act on your connected stores and tools directly. The whole platform is Apache-2.0-licensed and runs on your own infrastructure with `docker compose up`.

## Specialist agents

The super-agent orchestrates 14 specialist agents, each mounted as its own MCP server ([`apps/mcp`](apps/mcp)):

| Agent | Tools | What it does |
|---|---|---|
| Product Researcher | 8 | Market and product research across Amazon, eBay, Alibaba, AliExpress, Google Trends |
| Business Analyst | 7 | Break-even, TAM/SAM/SOM, financial scenarios, decision matrices, growth projections |
| Marketer | 4 | Social trends, competitor ad intel, domain authority |
| SEO Agent | 3 | Domain authority, meta-tag scraping, Shopify storefront SEO |
| Shopify Agent | 6 | Product create/read/update/delete, publish/unpublish |
| HubSpot Agent | 34 | Contacts, companies, deals, tickets, pipelines, marketing emails |
| Google Drive Agent | 13 | Search, read, write, copy, move, delete, sharing permissions |
| Facebook Page Agent | 8 | Posts, images, comments, engagement |
| Instagram Agent | 4 | Profile, media, insights, publishing |
| Email Marketing Agent | 42 | Brevo (20) + Mailchimp (22) contact and campaign management |
| Customer Support Agent | 15 | Zendesk ticket lifecycle, comments, users, views, metrics |
| Analytics Agent | 10 | Shopify revenue/inventory metrics + GA4 traffic and conversion |
| Meta Ads Agent | 13 | Accounts, campaigns, ad sets, creatives, ads, insights |
| Google Ads Agent | 14 | Campaigns, ad groups, ads, creative assets, performance |
| **Custom Agent** | 155+ | All tools above, flattened, plus dynamically registered n8n workflow tools |

Full tool-level reference: [`apps/mcp/docs/tools-reference.md`](apps/mcp/docs/tools-reference.md).

## Integrations

<div align="center">

Shopify · HubSpot · Google Drive · Facebook Pages · Instagram · Meta Ads · Google Ads · Google Analytics 4 · Brevo · Mailchimp · Zendesk · n8n

</div>

Each integration authenticates per-organization; credentials are encrypted at rest in the backend and fetched by the MCP server only at tool-call time — nothing is cached in the AI Engine or MCP layer. Adding a new one is a template implementation plus a client — see [Adding New Tools](apps/mcp/README.md#adding-new-tools).

## Features

- **Multi-agent orchestration** — a LangGraph supervisor delegates to specialist sub-agents, with streaming responses over WebSocket
- **Long-term memory** — conversation checkpoints and vector memory in MongoDB, knowledge-graph memory via Graphiti + Neo4j
- **Workflow automation** — n8n workflow templates register themselves as agent tools automatically, with Pydantic models generated from the template schema
- **Team workspaces** — organizations, roles, and invitations, multi-tenant within your own instance
- **Encrypted credentials** — third-party secrets are AES-256-GCM encrypted at rest and never persisted outside the backend
- **Self-hostable** — every service ships as a container; `docker compose up` brings up the full stack including databases

## Quick start

**Requirements:** Docker with Compose v2 and an [OpenRouter API key](https://openrouter.ai/keys).

```bash
git clone https://github.com/Ignitic-AI/ignitic.git
cd ignitic
cp .env.example .env          # set OPENROUTER_API_KEY
docker compose up -d --build
```

Open **http://localhost:3000** and create an account.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API · Swagger | http://localhost:8080 · http://localhost:8080/swagger/index.html |
| AI Engine | http://localhost:8010 |
| MCP server | http://localhost:8011 |
| RabbitMQ console | http://localhost:15672 |
| Neo4j browser | http://localhost:7474 |

Optional n8n for workflow tools: `docker compose --profile n8n up -d`.

> The defaults in `.env.example` are for local development only. See [SECURITY.md](SECURITY.md#hardening-self-hosted-deployments) before exposing an instance.

## Architecture

```
                         ┌────────────────────────┐
                         │  Frontend  (Next.js)   │  :3000
                         └───────────┬────────────┘
                     REST + WebSocket│
                         ┌───────────▼────────────┐
                         │  Backend  (Go · Gin)   │  :8080   auth · orgs · credentials · assets · logs
                         └──┬─────────────┬───────┘
                   PostgreSQL · Redis     │ RabbitMQ
                         ┌────────────────▼───────┐
                         │ AI Engine (FastAPI ·   │  :8010   agents · memory · workflows
                         │ LangGraph)             │
                         └──┬─────────────┬───────┘
                MongoDB · Neo4j           │ MCP (streamable HTTP)
                         ┌────────────────▼───────┐
                         │ MCP server (FastMCP)   │  :8011   15 tool servers · 190+ tools
                         └────────────────────────┘
                                      │
                    Shopify · HubSpot · Meta · Google · Zendesk · …
```

## Repository layout

```
ignitic/
├── apps/
│   ├── frontend/     Next.js 15 web app                        → apps/frontend/README.md
│   ├── backend/      Go + Gin API, PostgreSQL migrations       → apps/backend/README.md
│   ├── ai-engine/    FastAPI + LangGraph agent runtime         → apps/ai-engine/README.md
│   └── mcp/          FastMCP tool servers                      → apps/mcp/README.md
├── docker-compose.yml
├── .env.example
└── .github/          CI, issue and PR templates
```

Each app is self-contained with its own toolchain, tests and `.env.example`. See the app READMEs to run one natively against the Compose infrastructure:

```bash
docker compose up -d postgres redis rabbitmq mongo neo4j
```

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS 4, Zustand, NextAuth |
| Backend | Go 1.23, Gin, GORM, Goose, PostgreSQL, Redis, RabbitMQ |
| AI Engine | Python 3.12, FastAPI, LangChain, LangGraph, Graphiti, MongoDB, Neo4j |
| MCP | Python 3.12, FastMCP 2, Starlette |

## FAQ

**Do I need every database running?** Yes for the full stack — Postgres (backend), Redis (backend caching), RabbitMQ (agent task queue), MongoDB (agent memory and vector search), and Neo4j (knowledge-graph memory). `docker compose up` brings up all of them; see [Quick start](#quick-start).

**How do I add a new integration?** Copy an existing client under `apps/mcp/servers/tools/`, register its tools with the relevant agent's FastMCP server, and add credential handling in the backend's `secrets` module. [`apps/mcp/README.md`](apps/mcp/README.md#adding-new-tools) walks through it.

**Can I run just one app against the rest in Docker?** Yes — start the infrastructure and any apps you don't need in containers (`docker compose up -d postgres redis rabbitmq mongo neo4j backend`), then run the app you're working on natively per its own README.

**Is my data sent anywhere outside my instance?** Only to the LLM provider (OpenRouter, by default) for inference, and to whichever third-party integrations you connect (Shopify, HubSpot, etc.) for the tool calls you make. Nothing is sent to Ignitic AI's own servers.

## Status

Ignitic is a young open-source release: expect rough edges, incomplete test coverage in places, and breaking changes before a 1.0. It isn't a hosted product — you run and operate your own instance, so treat provider API keys, database credentials, and compliance requirements as your responsibility. See [SECURITY.md](SECURITY.md) before exposing an instance beyond your own machine.

## Contributing

Contributions are welcome — bug reports, docs, new MCP tools and integrations especially. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and look for issues labeled [`good first issue`](https://github.com/Ignitic-AI/ignitic/labels/good%20first%20issue).

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) and report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

Ignitic is released under the [Ignitic Open Source License](LICENSE): Apache License 2.0 with two additional conditions —

1. You may not offer Ignitic as a **multi-tenant hosted service** to third parties without a commercial license.
2. You may not **remove or replace the Ignitic branding** in the frontend without a commercial license.

Everything else — self-hosting, modifying, using it inside your company or as the backend of your own product — is allowed. The Ignitic name and logo are covered by the [Trademark Policy](TRADEMARK.md).

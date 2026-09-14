# Ignitic AI — Backend: Project Introduction

## What Is Ignitic AI?

Ignitic AI is a real-time SaaS platform that brings agentic automation to e-commerce operations. It is designed for e-commerce founders, operators, and consultants who need to streamline day-to-day tasks — from handling customer queries and resolving support tickets to running marketing campaigns, updating CRM records, and managing inventory — without writing custom automation code.

The platform replaces traditional sequential workflow labor with a single AI abstraction layer powered by large language models (LLMs) and automation engines such as n8n.

---

## Problem Statement

Traditional e-commerce automation:

- Requires expert labor to configure and maintain sequential workflows.
- Does not adapt to edge cases or changing business context.
- Produces siloed tooling that is hard to scale across departments.

Ignitic AI addresses this by providing an agentic layer that:

- Interprets goals expressed in natural language.
- Selects and orchestrates the right tools automatically.
- Integrates with existing e-commerce stacks (Shopify, WooCommerce, HubSpot, Zoho, WhatsApp, etc.).

---

## Use Cases

| Domain | Capability |
|---|---|
| Sales & Marketing | Campaign creation, email sequences, personalized workflows |
| Customer Support | Query resolution, automated ticketing, CRM updates |
| Product | Recommendations, inventory alerts, catalog updates |
| Analytics | Business intelligence reports, agent usage analytics |
| Operations | Credential management, role-based access, audit logging |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (SPA)                              │
│                     Next.js – Session & UI                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ REST / WebSocket
┌───────────────────────────────▼─────────────────────────────────────┐
│                      Backend API  (this repo)                       │
│              Go 1.23 + Gin · PostgreSQL · RabbitMQ                  │
│  Auth · Orgs · Assets · Secrets · Credits · Logs · Agents · Todos  │
└──────────┬────────────────────┬──────────────────────────┬──────────┘
           │ HTTP               │ AMQP                     │ HTTP
┌──────────▼──────────┐  ┌──────▼──────────────┐  ┌───────▼──────────┐
│    AI Engine        │  │     RabbitMQ        │  │   MCP Server     │
│  FastAPI + LangGraph│  │  (message broker)   │  │  LLM tool layer  │
│  Memory · Agents    │  │                     │  │                  │
└─────────────────────┘  └─────────────────────┘  └──────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                       Third-Party Integrations                      │
│   Shopify · HubSpot · Zoho · n8n · Cloudinary · Brevo (email)      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Technology | Responsibility |
|---|---|---|
| **Frontend SPA** | Next.js | Session management, UI presentation |
| **Backend API** | Go + Gin | Auth, orgs, assets, secrets, logs, credits, agents relay |
| **AI Engine** | FastAPI + LangGraph | Agent memory, LLM workflows, tool orchestration |
| **MCP Server** | — | LLM tool exposure layer |
| **RabbitMQ** | AMQP | Async agent chat queue between backend and AI engine |
| **PostgreSQL** | — | Primary persistent data store |
| **Cloudinary** | CDN / storage | Asset file storage and delivery |
| **Brevo** | Email SaaS | Transactional email (verification, invites, password reset) |

---

## Backend Service Scope

This repository contains only the **Backend API** component. It is a stateless Go service that:

1. Authenticates users (email/password + Google OAuth) and issues JWT tokens.
2. Manages multi-tenant organizations, memberships, roles, and invitations.
3. Stores and encrypts third-party credentials (secrets) per user or organization.
4. Relays agent chat requests to the AI Engine via RabbitMQ and streams responses back to the browser over WebSocket.
5. Provides an asset management layer (upload, categorize, retrieve) backed by Cloudinary.
6. Tracks a credit/billing system with per-plan entitlements and usage records.
7. Maintains structured audit logs for every API interaction.
8. Manages n8n workflow templates importable by users.
9. Exposes a todo/task tracker with agent task scheduling.
10. Delivers analytics on agent runs, tool executions, and usage.

---

## Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Language | Go 1.23 | Performance, static typing, strong concurrency primitives |
| HTTP framework | Gin | Low overhead, middleware ecosystem |
| ORM | GORM | Idiomatic Go, PostgreSQL integration |
| Migrations | Goose | SQL-first, version-controlled schema changes |
| Auth tokens | JWT (golang-jwt/jwt v5) | Stateless, cross-service interoperability |
| Password hashing | bcrypt | Industry standard, work-factor tuneable |
| Secret encryption | AES-256-GCM | Authenticated encryption for stored credentials |
| Message queue | RabbitMQ (amqp091-go) | Reliable async delivery for agent requests |
| WebSocket | gorilla/websocket | Mature, well-maintained |
| File storage | Cloudinary | Managed CDN with transformation pipeline |
| Email | Brevo (Sendinblue) | Transactional email API |
| API docs | Swaggo / Swagger UI | Auto-generated from code annotations |
| Containerisation | Docker (multi-stage) | Reproducible builds, minimal final image |
| Deployment | AWS ECS + ECR | Managed container orchestration |
| CI/CD | GitHub Actions | Automated build and deploy on push to `prod` |

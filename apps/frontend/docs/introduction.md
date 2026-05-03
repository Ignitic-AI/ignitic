# Ignitic AI — Project Introduction

## 1. Background

Ignitic AI is a real-time web application designed to streamline interactions between **e-commerce founders, operators, and consultants** through AI-driven assistance. Traditional e-commerce operations require sequential workflows that demand significant expert labor. Ignitic AI replaces this operational overhead by providing a single AI abstraction layer for the most common business tasks.

The platform couples agentic AI with automation tools (n8n, Make, etc.) to drive:

- **Sales & Marketing** — campaign drafts, product copy, promotion scheduling
- **Customer Query Resolution** — automated ticket handling, FAQ responses
- **Product Recommendations** — personalized suggestions based on browsing/purchase data
- **Automated Ticketing & CRM Updates** — syncing conversations to HubSpot, Zoho, etc.
- **Inventory Alerts & Updates** — low-stock notifications, reorder workflows
- **Personalized Marketing Workflows** — email sequences, SMS drips, WhatsApp outreach

---

## 2. Product Vision

> **"One AI super-agent that handles the operational complexity of running an e-commerce business."**

By integrating advanced LLM capabilities (via LangGraph multi-agent orchestration) with workflow automation (n8n), Ignitic AI enables non-technical e-commerce operators to automate previously manual, labor-intensive tasks through natural language.

---

## 3. Stakeholders

| Role | Responsibilities |
|---|---|
| **E-commerce Founders** | Define goals, monitor AI performance, manage billing |
| **E-commerce Operators** | Day-to-day use — chat with AI, trigger workflows, review analytics |
| **Consultants** | Advise clients, configure agents and automations on their behalf |
| **Ignitic AI Engineering** | Develop and maintain the platform |
| **Third-party Integrations** | Shopify, WooCommerce, HubSpot, Zoho, Klaviyo, etc. |

---

## 4. System Overview

The overall Ignitic AI system consists of five loosely coupled services:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ignitic AI Platform                       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Frontend    │  │  Backend API │  │  AI Engine          │   │
│  │  (Next.js)   │◄─┤  (Go + Gin)  │  │  (FastAPI +        │   │
│  │  This repo   │  │              │  │   LangGraph)        │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  MCP Server  │  │  Ignitic SDK │                            │
│  │  (LLM tool   │  │  (Go/Python) │                            │
│  │   exposure)  │  │              │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 Frontend SPA (this repository)

- **Technology:** Next.js 15, TypeScript, Tailwind CSS, Zustand
- **Role:** Session management, user authentication, routing, and all user-facing presentation
- **Deployment:** AWS Amplify Hosting (standalone SSR)

### 4.2 Backend API

- **Technology:** Go + Gin
- **Responsibilities:** Authentication (JWT), organization management, asset storage metadata, secrets vault, credits and billing, logs, user management

### 4.3 AI Engine

- **Technology:** FastAPI + LangGraph
- **Responsibilities:** Multi-agent orchestration, persistent conversation memory, tool routing, streaming responses via WebSocket

### 4.4 MCP Server

- **Role:** Exposes tools to the LLM layer (e.g., Shopify APIs, CRM connectors, workflow triggers) following the Model Context Protocol

### 4.5 Ignitic SDK

- **Languages:** Go and Python
- **Role:** Developer toolkit for building custom agents and integrating with the Ignitic AI platform

---

## 5. Key Integration Points

| Integration | How it is used |
|---|---|
| Shopify / WooCommerce | Order management, product catalog, inventory |
| HubSpot / Zoho | CRM record updates, contact sync |
| Klaviyo / Email platforms | Marketing automation triggers |
| WhatsApp / SMS | Customer communication workflows |
| n8n | Workflow automation engine backing agent tools |
| Cloudinary | Media asset storage for chat attachments |

---

## 6. Design Principles

1. **Streaming-first** — All AI responses stream token by token to minimize perceived latency.
2. **Multi-tenant** — Organizations are first-class citizens; all data is scoped to an organization.
3. **Credits-gated** — Feature access and model selection are controlled by subscription plan and credit balance.
4. **Dark/light theming** — Full dual-theme support with system preference detection.
5. **Progressive disclosure** — Complex features are revealed contextually to reduce cognitive overhead.

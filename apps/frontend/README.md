# Ignitic AI — Frontend

> Next.js app for [Ignitic](../../README.md) — an AI-powered super-agent designed to streamline e-commerce operations.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Overview

The Ignitic AI frontend is a real-time single-page application (SPA) built with **Next.js 15 (App Router)**. It serves as the primary interface for e-commerce founders, operators, and consultants to interact with an AI super-agent that automates common operational tasks including sales, marketing, customer service, inventory management, and more.

The frontend communicates with:

| Service | Role |
|---|---|
| **Backend API** (Go + Gin) | Auth, organizations, assets, secrets, credits, logs |
| **AI Engine** (FastAPI + LangGraph) | AI agents, memory, streaming chat via WebSocket |
| **Cloudinary** | File and image uploads for chat attachments |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend SPA (Next.js 15)               │
│                                                         │
│  ┌─────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │  App Router │  │ Zustand Stores│  │ NextAuth.js   │  │
│  │  (sidebar / │  │ Session / Org │  │ JWT Strategy  │  │
│  │  no_sidebar)│  │ Analytics /   │  │               │  │
│  └─────────────┘  │ Onboarding/WS │  └───────────────┘  │
│                   └───────────────┘                     │
└──────────────┬──────────────────────┬───────────────────┘
               │ REST / HTTP          │ WebSocket
               ▼                      ▼
   ┌──────────────────┐   ┌────────────────────────┐
   │  Backend API     │   │  AI Engine (FastAPI +  │
   │  (Go + Gin)      │   │  LangGraph)            │
   │  /api/v1/*       │   │  /api/v1/agents/ws     │
   └──────────────────┘   └────────────────────────┘
               │
               ▼
   ┌──────────────────┐
   │  Cloudinary CDN  │
   │  (file uploads)  │
   └──────────────────┘
```

The frontend builds as a **standalone Next.js server** (`output: "standalone"`) and ships as a Docker image.

---

## Key Features

| Feature | Description |
|---|---|
| **AI Chat** | Real-time streaming chat with AI agents via WebSocket. Supports tool calls, agent handoffs, file/image attachments, and chat sharing. |
| **Workflow Management** | Browse, import, and manage n8n automation workflows. |
| **Agents & Tools** | Create, configure, and monitor custom AI agents and their associated tools. |
| **Assets** | Upload and manage business assets (documents, images) stored via Cloudinary. |
| **Secrets & Integrations** | Securely store API keys and credentials for third-party integrations (Shopify, HubSpot, etc.). |
| **Analytics** | Track agent runs, token usage, cost, and tool invocations with configurable dashboard widgets. |
| **Organization Management** | Multi-tenant support — create organizations, invite members, and assign roles (owner / admin / member). |
| **Credits System** | Usage-based billing with per-plan entitlements, feature gates, and credit balance tracking. |
| **Onboarding** | Guided 4-step onboarding flow for new users to set up their profile and organization. |
| **Shared Chat** | Public read-only shareable chat links. |
| **Dark / Light Mode** | Full system-aware theming powered by `next-themes`. |

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI primitives) |
| State Management | Zustand 5 |
| Authentication | NextAuth.js v4 (Credentials provider, JWT strategy) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Animations | Framer Motion + GSAP |
| Flow Diagrams | @xyflow/react (React Flow) |
| File Storage | Cloudinary |
| HTTP Client | Axios |
| Real-time | Native WebSocket API |
| Deployment | Docker (standalone Next.js server) |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Installation

```bash
# Install dependencies
npm ci

# Copy environment file and fill in values
cp .env.example .env.local
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure the values:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL as seen by the browser (e.g., `http://localhost:8080`). Inlined at build time. |
| `API_INTERNAL_URL` | ☑️ | Backend URL for server-side calls when it differs from the public one (e.g., `http://backend:8080` in Docker Compose) |
| `NEXTAUTH_SECRET` | ✅ | Random secret for NextAuth JWT signing. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Canonical site URL (e.g., `http://localhost:3000`). Required in production. |
| `AUTH_TRUST_HOST` | ☑️ (prod) | Set to `true` behind a reverse proxy to derive the URL from `x-forwarded-host` |
| `CLOUDINARY_CLOUD_NAME` | ☑️ | Cloudinary cloud name for file uploads |
| `CLOUDINARY_API_KEY` | ☑️ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ☑️ | Cloudinary API secret |

---

## Project Structure

```
frontend/
├── public/                  # Static assets (fonts, images, logos)
├── src/
│   ├── app/
│   │   ├── (sidebar)/       # Authenticated routes with sidebar layout
│   │   │   ├── page.tsx     # Dashboard (home)
│   │   │   ├── analytics/   # Analytics & custom dashboard widgets
│   │   │   ├── agents_and_tools/ # AI agent management
│   │   │   ├── assets/      # Asset management
│   │   │   ├── organization/# Organization management
│   │   │   ├── profile/     # User profile
│   │   │   ├── secrets/     # Secrets & integrations
│   │   │   └── workflows/   # Workflow management
│   │   ├── (no_sidebar)/    # Unauthenticated / full-screen routes
│   │   │   ├── chat/[chatId]/ # Full-screen AI chat
│   │   │   ├── onboarding/  # 4-step onboarding flow
│   │   │   ├── signup/      # Registration
│   │   │   ├── verification/# Email verification
│   │   │   └── reset-password/
│   │   ├── shared/chat/[token]/ # Public shared chat viewer
│   │   ├── signin/          # Sign-in page
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/ # NextAuth handler
│   │   │   └── upload/      # Cloudinary upload proxy
│   │   ├── _store/          # Zustand global stores
│   │   │   ├── useSessionStore.ts
│   │   │   ├── useorgStore.ts
│   │   │   ├── useOnboardingStore.ts
│   │   │   ├── useAnalyticsStore.ts
│   │   │   └── useWebSocketStore.ts
│   │   ├── globals.css      # Tailwind base + CSS custom properties
│   │   ├── layout.tsx       # Root layout (ThemeProvider, Toaster)
│   │   └── providers.tsx    # Client-side providers
│   ├── components/          # Shared React components
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── AppSidebar.tsx   # Main navigation sidebar
│   │   ├── ChatWindow.tsx   # AI chat interface
│   │   ├── PromptBox.tsx    # Dashboard AI prompt
│   │   ├── Workflows.tsx    # Workflow list & management
│   │   ├── Assets.tsx       # Asset upload & viewer
│   │   └── ...
│   ├── context/             # React context providers
│   │   └── credits-context.tsx
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── api.ts           # API base URL helpers
│   │   ├── auth.ts          # NextAuth options & JWT helpers
│   │   ├── credits.ts       # Credits API + entitlement helpers
│   │   ├── saved-items.ts   # Saved items helpers
│   │   ├── utils.ts         # Tailwind cn() utility
│   │   └── validations.ts   # Zod validation schemas
│   └── types/               # TypeScript type definitions
│       └── chat.ts          # StreamingMessage type
├── types/                   # Global declaration files
│   ├── images.d.ts
│   └── websocket.d.ts
├── .env.example             # Environment variable template
├── Dockerfile               # Standalone production image
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── components.json          # shadcn/ui configuration
└── docs/                    # Project documentation
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |

---

## Deployment

Build the production image:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t ignitic-frontend .
```

`NEXT_PUBLIC_API_URL` is baked into the client bundle, so rebuild the image when it changes. To run the whole platform, use `docker compose up` from the [repository root](../../README.md#quickstart).

---

## Documentation

Comprehensive project documentation lives in the [`docs/`](./docs/) directory:

| Document | Description |
|---|---|
| [docs/introduction.md](./docs/introduction.md) | Project background, goals, and system overview |
| [docs/database-schemas.md](./docs/database-schemas.md) | Frontend data models and TypeScript interfaces |
| [docs/api-reference.md](./docs/api-reference.md) | Backend API endpoints consumed by the frontend |
| [docs/testing.md](./docs/testing.md) | Testing strategy and guidelines |
| [docs/styles.md](./docs/styles.md) | Design system and component style guide |

---

## Contributing

See the repository [CONTRIBUTING.md](../../CONTRIBUTING.md). For UI work, follow the design system in [`docs/styles.md`](./docs/styles.md).

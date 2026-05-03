# Software Requirements Specification (SRS)

**Project:** Ignitic AI — Frontend SPA  
**Version:** 1.0  
**Scope:** This document covers requirements for the Next.js frontend only. Refer to respective service documentation for Backend API, AI Engine, and MCP Server requirements.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [External Interface Requirements](#5-external-interface-requirements)
6. [Constraints](#6-constraints)

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the requirements for the Ignitic AI frontend application — the user-facing Next.js SPA that enables e-commerce teams to interact with AI agents, manage workflows, and monitor operational analytics.

### 1.2 Scope

The frontend provides:
- User authentication and session management
- AI chat interface with real-time streaming
- Organization and team management
- Workflow management (n8n integration)
- Asset management (Cloudinary)
- Secrets and integrations vault
- Analytics dashboard
- Onboarding flow

### 1.3 Definitions

| Term | Definition |
|---|---|
| Agent | An AI entity configured to perform a specific e-commerce task |
| Workflow | An n8n automation blueprint that an agent can invoke |
| Organization | A tenant in the multi-tenant system representing a business |
| Credits | Usage units consumed when interacting with AI agents |
| Streaming | Delivering AI response tokens incrementally over WebSocket |

---

## 2. Overall Description

### 2.1 Product Perspective

The frontend is one component of the broader Ignitic AI platform. It interfaces with:
- The **Backend API** (REST over HTTPS) for business data
- The **AI Engine** (WebSocket) for real-time AI interactions
- **Cloudinary** (HTTPS) for media uploads
- **NextAuth.js** internally for session management

### 2.2 User Classes

| Class | Description |
|---|---|
| **Unauthenticated User** | Can view the sign-in/sign-up pages and shared chat links |
| **Authenticated User** | Full access to dashboard, chat, and settings after login |
| **Organization Owner** | Can manage org settings, billing, and all members |
| **Organization Admin** | Can manage members and integrations but not billing |
| **Organization Member** | Standard access — chat, workflows, analytics |

### 2.3 Assumptions and Dependencies

- A backend API is accessible at the URL defined by `NEXT_PUBLIC_API_URL`.
- The backend issues JWTs with an `exp` claim for token expiry.
- Cloudinary credentials are configured for file uploads.
- Node.js 20+ is available in the build environment.

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement |
|---|---|
| AUTH-01 | Users shall be able to sign in with email and password. |
| AUTH-02 | Users shall be able to register a new account. |
| AUTH-03 | Users shall be able to reset their password via email. |
| AUTH-04 | Users shall be able to verify their email address. |
| AUTH-05 | Sessions shall persist using JWT strategy with a 24-hour maximum age. |
| AUTH-06 | Expired backend JWTs shall be detected client-side and result in re-authentication. |
| AUTH-07 | Unauthenticated users accessing protected routes shall be redirected to the sign-in page. |

### 3.2 Onboarding

| ID | Requirement |
|---|---|
| OB-01 | New users shall be guided through a 4-step onboarding flow (Account Setup → Organization Details → Invite Members → Preferences). |
| OB-02 | Users with an existing organization shall be prompted to create one during onboarding. |
| OB-03 | Step navigation shall validate required fields before proceeding. |
| OB-04 | Users may skip optional onboarding steps. |
| OB-05 | Onboarding state shall persist across page refreshes using session storage. |
| OB-06 | On completion, users shall be redirected to the Dashboard. |

### 3.3 Dashboard

| ID | Requirement |
|---|---|
| DASH-01 | The dashboard shall display an AI prompt box for quick queries. |
| DASH-02 | The dashboard shall show AI-generated suggestions relevant to the user's context. |
| DASH-03 | The dashboard shall display a to-do/checklist widget. |
| DASH-04 | The dashboard shall display key performance metrics for AI agent activity. |

### 3.4 AI Chat

| ID | Requirement |
|---|---|
| CHAT-01 | Users shall be able to start a new chat session with a unique UUID-based chat ID. |
| CHAT-02 | Chat messages shall stream token-by-token from the AI engine via WebSocket. |
| CHAT-03 | The system shall display tool call status (calling / done) inline within the chat. |
| CHAT-04 | The system shall display agent handoff transitions when the active agent changes. |
| CHAT-05 | Users shall be able to attach images and files to messages via Cloudinary upload. |
| CHAT-06 | Users shall be able to share a chat session via a public read-only link. |
| CHAT-07 | Shared chat links shall be viewable without authentication. |
| CHAT-08 | The chat sidebar shall list previous chat sessions. |
| CHAT-09 | AI responses shall render Markdown including tables, code blocks, and GFM. |

### 3.5 Workflow Management

| ID | Requirement |
|---|---|
| WF-01 | Users shall be able to view a list of available workflow templates. |
| WF-02 | Users shall be able to import workflow templates into their n8n instance. |
| WF-03 | Users shall be able to view the status of active workflows. |
| WF-04 | Workflows shall be displayed with a visual graph layout using React Flow. |

### 3.6 Agents & Tools

| ID | Requirement |
|---|---|
| AG-01 | Users shall be able to view all available agents and tools. |
| AG-02 | Users shall be able to create a new custom agent. |
| AG-03 | Users shall be able to view the details and configuration of a specific agent. |
| AG-04 | Agents shall be displayed with their associated tools and capabilities. |

### 3.7 Assets

| ID | Requirement |
|---|---|
| ASS-01 | Users shall be able to upload files and images as business assets. |
| ASS-02 | Users shall be able to view and manage uploaded assets. |
| ASS-03 | File uploads shall be proxied through the Next.js API to Cloudinary. |
| ASS-04 | Documents (PDF, DOCX, etc.) shall be viewable inline using a document viewer. |

### 3.8 Secrets & Integrations

| ID | Requirement |
|---|---|
| SEC-01 | Users shall be able to store API keys and credentials for third-party services. |
| SEC-02 | Supported integrations shall include platforms such as Shopify, HubSpot, and others defined in the n8n credentials schema. |
| SEC-03 | Secret values shall never be displayed in plaintext after initial entry. |
| SEC-04 | Users shall be able to delete stored secrets. |

### 3.9 Organization Management

| ID | Requirement |
|---|---|
| ORG-01 | Users shall be able to create new organizations. |
| ORG-02 | Users shall be able to view all organizations they belong to. |
| ORG-03 | Organization owners and admins shall be able to invite members by email. |
| ORG-04 | Members shall have roles: owner, admin, or member. |
| ORG-05 | Users shall be able to switch the active organization context. |
| ORG-06 | Organization details (name, size, country, industry, domain) shall be editable. |

### 3.10 Analytics

| ID | Requirement |
|---|---|
| AN-01 | Users shall be able to view agent run counts, total run time, and average duration. |
| AN-02 | Users shall be able to view total token usage (input, output, total) by agent. |
| AN-03 | Users shall be able to view estimated AI cost in USD. |
| AN-04 | Users shall be able to view tool and workflow invocation counts. |
| AN-05 | Analytics widgets shall be configurable (chart type, metric, time range, size). |
| AN-06 | The analytics dashboard layout shall be user-customizable and persisted locally. |
| AN-07 | Time range filter shall support: Last 7 days, Last 28 days, Last 90 days. |

### 3.11 Credits & Billing

| ID | Requirement |
|---|---|
| CR-01 | Users shall be able to view their current credit balance and billing cycle. |
| CR-02 | The UI shall gate features and models based on plan entitlements. |
| CR-03 | Users shall be notified when they have insufficient credits for an action. |
| CR-04 | Credit consumption history shall be viewable. |

### 3.12 User Profile

| ID | Requirement |
|---|---|
| PROF-01 | Users shall be able to view and update their profile information. |
| PROF-02 | Users shall be able to upload a profile picture. |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|---|---|
| PERF-01 | Initial page load (LCP) shall be under 3 seconds on a standard broadband connection. |
| PERF-02 | First AI response token shall appear within 2 seconds of message submission under normal load. |
| PERF-03 | The application shall use code splitting and lazy loading to minimize initial bundle size. |

### 4.2 Security

| ID | Requirement |
|---|---|
| SEC-NFR-01 | All API requests shall use HTTPS in production. |
| SEC-NFR-02 | The NextAuth secret shall be a cryptographically random value of at least 32 bytes. |
| SEC-NFR-03 | JWT tokens shall not be stored in localStorage; NextAuth uses httpOnly cookies. |
| SEC-NFR-04 | Cloudinary uploads shall be proxied through the Next.js API — Cloudinary secrets shall not be exposed to the browser. |
| SEC-NFR-05 | The `Content-Security-Policy` and other security headers shall be configured in `public/_headers`. |

### 4.3 Usability

| ID | Requirement |
|---|---|
| USE-01 | The application shall support both light and dark themes with system preference detection. |
| USE-02 | The application shall be responsive and functional on desktop browsers (≥ 1024px). |
| USE-03 | All interactive elements shall have visible focus states for keyboard navigation. |
| USE-04 | Loading states shall be communicated to the user via spinners or skeleton loaders. |
| USE-05 | Errors and success events shall be surfaced via toast notifications. |

### 4.4 Reliability

| ID | Requirement |
|---|---|
| REL-01 | The WebSocket connection shall reconnect automatically on disconnection. |
| REL-02 | API errors shall be caught and presented to the user with an actionable message. |

### 4.5 Maintainability

| ID | Requirement |
|---|---|
| MAINT-01 | The codebase shall use TypeScript with strict mode. |
| MAINT-02 | Shared components shall be placed in `src/components/`. |
| MAINT-03 | Global state shall be managed exclusively through Zustand stores in `src/app/_store/`. |

---

## 5. External Interface Requirements

### 5.1 Backend API Interface

- Protocol: HTTPS REST
- Authentication: Bearer JWT in `Authorization` header
- Base path: `/api/v1/`
- Content type: `application/json`

### 5.2 AI Engine Interface

- Protocol: WebSocket (`wss://`)
- Path: `/api/v1/agents/ws`
- Authentication: JWT passed as query parameter or header on connect
- Message format: JSON streaming events

### 5.3 Cloudinary Interface

- Upload proxy at Next.js API route `/api/upload`
- Accepts `multipart/form-data` with one or more `file` fields
- Returns `{ urls: string[] }` of Cloudinary secure URLs

---

## 6. Constraints

| Constraint | Description |
|---|---|
| Node.js version | Must use Node.js 20 (enforced in `amplify.yml`) |
| Next.js version | Must use Next.js 15 with App Router |
| Next.js output | `standalone` output required for AWS Amplify SSR |
| Browser support | Modern evergreen browsers only (Chrome, Firefox, Safari, Edge) |
| No localStorage for session | NextAuth session storage uses cookies, not localStorage |

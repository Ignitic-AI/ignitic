# Software Design Specification (SDS)

**Project:** Ignitic AI — Frontend SPA  
**Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Routing Structure](#3-routing-structure)
4. [Component Architecture](#4-component-architecture)
5. [State Management](#5-state-management)
6. [Authentication Design](#6-authentication-design)
7. [Real-time Communication](#7-real-time-communication)
8. [Data Flows](#8-data-flows)
9. [Theming System](#9-theming-system)
10. [Error Handling](#10-error-handling)

---

## 1. Overview

The Ignitic AI frontend is a **Next.js 15 App Router** application using the **React Server Components** model for page-level rendering and **Client Components** for interactive UI elements. It uses **Zustand** for global state and **NextAuth.js** for authentication with a credentials-based JWT strategy.

---

## 2. Architecture

### 2.1 Layer Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Next.js App                        │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌────────────────────────────┐   │   │
│  │  │ Server Comps │  │  Client Components ("use    │   │   │
│  │  │ (RSC)        │  │  client" — most pages)     │   │   │
│  │  │ profile/page │  └───────────────┬────────────┘   │   │
│  │  └──────────────┘                  │                │   │
│  │                          ┌─────────▼──────────┐     │   │
│  │                          │  Zustand Stores     │     │   │
│  │                          │  (global state)     │     │   │
│  │                          └─────────┬──────────┘     │   │
│  │                                    │                │   │
│  │  ┌──────────────────────────────────▼────────────┐  │   │
│  │  │              lib/ helpers                      │  │   │
│  │  │  api.ts  auth.ts  credits.ts  validations.ts  │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────┬──────────────────────┬───────────────────────────┘
            │ HTTPS REST           │ WSS WebSocket
            ▼                      ▼
   Backend API (Go)         AI Engine (FastAPI)
```

### 2.2 Key Architectural Decisions

| Decision | Rationale |
|---|---|
| App Router over Pages Router | Enables layout nesting, server components, and simpler route group organization |
| Client Components for most pages | AI streaming and Zustand hydration require client-side rendering |
| Zustand over Redux | Simpler API, smaller bundle size, first-class TypeScript support |
| NextAuth Credentials Provider | Backend owns authentication; NextAuth wraps backend JWTs in a secure cookie session |
| WebSocket over SSE | Bidirectional channel needed for future agent-to-user messages and interrupts |
| Cloudinary via server-side proxy | Keeps Cloudinary API secrets off the client bundle |
| `standalone` output | Required for Node.js SSR on AWS Amplify |

---

## 3. Routing Structure

Next.js App Router route groups organize pages by layout:

```
app/
├── (sidebar)/              ← Authenticated layout with collapsible sidebar
│   ├── layout.tsx          ← SidebarProvider + AppSidebar wrapper
│   ├── page.tsx            ← / (Dashboard)
│   ├── analytics/          ← /analytics
│   ├── agents_and_tools/   ← /agents_and_tools
│   │   ├── page.tsx        ← Agent list
│   │   ├── create/         ← /agents_and_tools/create
│   │   └── [agent_id]/     ← /agents_and_tools/:id
│   ├── assets/             ← /assets
│   ├── organization/       ← /organization
│   │   ├── page.tsx        ← Organization list
│   │   ├── create/         ← /organization/create
│   │   └── [orgId]/        ← /organization/:id
│   ├── profile/            ← /profile
│   ├── secrets/            ← /secrets
│   └── workflows/          ← /workflows
│
├── (no_sidebar)/           ← Full-width layout (no sidebar)
│   ├── layout.tsx
│   ├── chat/[chatId]/      ← /chat/:chatId (AI chat)
│   ├── onboarding/[[...onboarding]]/  ← /onboarding/1..4
│   ├── signup/             ← /signup
│   ├── verification/       ← /verification
│   └── reset-password/     ← /reset-password
│
├── shared/
│   └── chat/[token]/       ← /shared/chat/:token (public, no auth)
│
├── signin/                 ← /signin
│
└── api/
    ├── auth/[...nextauth]/ ← NextAuth handler
    └── upload/             ← Cloudinary proxy
```

### 3.1 Authentication Guards

- Pages inside `(sidebar)` check session status via `useSession()` and redirect to `/signup` or `/signin` when unauthenticated.
- `/profile` uses `getServerSession()` (RSC) and calls `redirect("/signin")` server-side.
- `/shared/chat/[token]` is fully public — no auth check.

---

## 4. Component Architecture

### 4.1 Component Categories

| Category | Location | Description |
|---|---|---|
| **Layout** | `app/(sidebar)/layout.tsx`, `app/(no_sidebar)/layout.tsx` | Structural wrappers per route group |
| **Navigation** | `components/AppSidebar.tsx` | Collapsible icon sidebar using shadcn/ui Sidebar primitives |
| **Chat** | `components/ChatWindow.tsx`, `components/ChatDisplay.tsx`, `components/ChatSidebar.tsx`, `components/PromptBox.tsx` | Full AI chat stack |
| **Dashboard** | `components/DashboardMetrics.tsx`, `components/AISuggestions.tsx`, `components/Checklist.tsx`, `components/ChartsSection.tsx` | Dashboard widgets |
| **Organization** | `components/OrgDropdown.tsx`, `components/OrgInvite.tsx` | Org context switcher and invitations |
| **Profile** | `components/ProfileClient.tsx`, `components/UserAvatar.tsx`, `components/ProfileIcon.tsx` | User profile display |
| **Onboarding** | `components/Step1.tsx` – `Step4.tsx` | Step components for onboarding wizard |
| **Assets** | `components/Assets.tsx` | File upload and asset gallery |
| **Workflows** | `components/Workflows.tsx`, `components/ImportWorkflowDialog.tsx` | Workflow list and import dialog |
| **Utility** | `components/Loading.tsx`, `components/ThemeToggle.tsx`, `components/ThreeDotsLoader.tsx` | Shared utility components |
| **UI Primitives** | `components/ui/` | shadcn/ui components (Button, Dialog, Select, etc.) |

### 4.2 shadcn/ui Components Used

The project uses shadcn/ui as the component primitive layer. All primitives are located in `src/components/ui/` and are built on Radix UI. Key components include: `Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Label`, `ScrollArea`, `Select`, `Separator`, `Sheet`, `Sidebar`, `Switch`, `Tabs`, `Toast`, `Tooltip`.

---

## 5. State Management

All global state is managed with **Zustand**. Each store is defined in `src/app/_store/`.

### 5.1 Store Overview

| Store | File | Persistence | Purpose |
|---|---|---|---|
| `useSessionStore` | `useSessionStore.ts` | `sessionStorage` | Caches current NextAuth session for client stores |
| `useOrgStore` | `useorgStore.ts` | `sessionStorage` | Manages organization list and active organization |
| `useOnboardingStore` | `useOnboardingStore.ts` | `sessionStorage` | Persists 4-step onboarding form state |
| `useAnalyticsStore` | `useAnalyticsStore.ts` | None (in-memory) | Token usage data fetched from analytics API |
| `useWebSocketStore` | `useWebSocketStore.ts` | None (in-memory) | WebSocket connection, chat messages, streaming state |

### 5.2 Session Synchronization

`SessionSyncer.tsx` is a client component mounted inside the authenticated layout. It observes the NextAuth session (via `useSession()`) and mirrors it to `useSessionStore` so that non-React code (e.g., Zustand action functions) can access the token without using React hooks.

### 5.3 Organization Context

`OrgDropdown.tsx` allows the user to switch the active organization. The selected org is stored in `useOrgStore.currentOrg` and persisted to `sessionStorage`. All API calls that are org-scoped read this value.

---

## 6. Authentication Design

### 6.1 Flow

```
1. User submits email + password on /signin
2. NextAuth CredentialsProvider calls POST /api/v1/auth/login
3. Backend returns { token: "<JWT>", ...user }
4. NextAuth stores JWT in an encrypted httpOnly cookie
5. Frontend reads session via useSession() → { accessToken, user }
6. API calls include: Authorization: Bearer <accessToken>
7. On each session refresh, isBackendTokenExpired() checks the JWT exp claim
8. If expired, session.error = "TokenExpired" is set → client redirects to /signin
```

### 6.2 Token Expiry Handling

`lib/auth.ts` implements `isBackendTokenExpired()` which decodes the JWT payload (without verification) and checks the `exp` claim against `Date.now()`. This is a best-effort client-side check; the backend always performs authoritative verification.

### 6.3 NextAuth Configuration

```typescript
// Key settings in lib/auth.ts
{
  strategy: "jwt",
  maxAge: 24 * 60 * 60  // 24 hours
}
```

---

## 7. Real-time Communication

### 7.1 WebSocket Architecture

The AI chat uses a persistent WebSocket connection to the AI Engine:

```
Client                    AI Engine (FastAPI)
  │                              │
  │── WS Connect ───────────────►│
  │                              │
  │── { type: "message",         │
  │    content: "...",           │
  │    chat_id: "...", ... } ───►│
  │                              │
  │◄─ { type: "token",           │
  │     content: "..." } ────────│  (streaming)
  │◄─ { type: "tool_call", ... } │
  │◄─ { type: "transfer", ... }  │
  │◄─ { type: "final", ... } ────│
```

### 7.2 WebSocket URL

Constructed in `lib/api.ts`:
```typescript
export const getAgentsWebSocketUrl = () => {
  const base = API_BASE_URL || window.location.origin
  return `${base.replace(/^http/i, 'ws')}/api/v1/agents/ws`
}
```

### 7.3 Message Types

The `StreamingMessage` type in `src/types/chat.ts` represents a normalized message in the UI:

| Field | Type | Description |
|---|---|---|
| `sender` | `'user' \| 'ai'` | Message originator |
| `text` | `string` | Display text |
| `toolCalls` | `Array<{name, args, status}>` | Tool invocations with status |
| `agentName` | `string` | Name of the responding agent |
| `isStreaming` | `boolean` | True while tokens are arriving |
| `isFinalResponse` | `boolean` | True when stream is complete |
| `isToolDataMessage` | `boolean` | True for tool result messages |
| `isTransferMessage` | `boolean` | True for agent handoff events |
| `image_urls` | `string[]` | Attached image URLs |
| `file_urls` | `string[]` | Attached file URLs |

---

## 8. Data Flows

### 8.1 Login Flow

```
SignIn component
  → next-auth signIn('credentials', { email, password })
    → NextAuth CredentialsProvider.authorize()
      → POST /api/v1/auth/login
        ← { token, name, email, ... }
    ← Session created (httpOnly cookie)
  → redirect to /
```

### 8.2 Chat Message Flow

```
User types message in PromptBox or ChatWindow
  → useWebSocketStore.sendMessage(text, files)
    → Upload files to /api/upload → Cloudinary URLs
    → Send WS message { type: 'user_message', content, image_urls, file_urls }
    → Append user message to messages[]
  ← AI Engine streams tokens
    → Each token: update last AI message text
    → Tool call events: append to toolCalls[]
    → Transfer event: append agent handoff message
    → Final event: mark isFinalResponse = true, isStreaming = false
```

### 8.3 Organization Switch Flow

```
OrgDropdown.onChange(orgId)
  → useOrgStore.setCurrentOrg(orgId)
    → Finds org in organizations[]
    → Sets currentOrg (persisted to sessionStorage)
  → All subsequent API calls use currentOrg.id as org scope
```

### 8.4 File Upload Flow

```
User selects file in ChatWindow / Assets
  → POST /api/upload (Next.js API route, multipart/form-data)
    → cloudinary.uploader.upload(file, { folder: 'chat_attachments' })
    ← { urls: ['https://res.cloudinary.com/...'] }
  → URL appended to message or asset record
```

---

## 9. Theming System

The project uses a dual-theme (dark/light) system implemented with:

1. **`next-themes`** — Provides `ThemeProvider` and `useTheme()` hook; persists to `localStorage`; default is `system`.
2. **Tailwind CSS v4 `@theme` directive** — Custom design tokens defined in `globals.css`:
   - Dark mode tokens: `--color-bg`, `--color-bg-light`, `--color-text`, etc.
   - Light mode tokens: `--color-bg-lm`, `--color-bg-light-lm`, `--color-text-lm`, etc.
3. **`dark:` prefix** — Applied on each element: e.g., `bg-bg-lm dark:bg-bg`.

See [`styles.md`](../styles.md) for the full design token reference.

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| API request failure | Caught in `try/catch` blocks; error message shown via `toast.error()` from Sonner |
| WebSocket disconnection | `useWebSocketStore` marks connection as closed; reconnection logic attempted |
| Expired JWT | `session.error === "TokenExpired"` detected by `SessionSyncer`; user redirected to sign-in |
| Unauthenticated route access | `useSession()` check in each protected page; redirects to `/signup` |
| Form validation failure | Zod schemas in `lib/validations.ts`; errors shown via `toast.error()` and shake animation |
| Cloudinary upload failure | Error caught in `/api/upload` route handler; `{ error: message }` returned with HTTP 500 |
| Credits insufficient | `canUseAction()` in `lib/credits.ts` returns `{ allowed: false, reason }` before API call |

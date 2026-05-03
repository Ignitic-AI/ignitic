# API Reference — Backend Endpoints

This document lists all backend API endpoints consumed by the Ignitic AI frontend. All requests use the base URL configured via `NEXT_PUBLIC_API_URL`.

**Base path:** `{NEXT_PUBLIC_API_URL}/api/v1`  
**Authentication:** All protected endpoints require `Authorization: Bearer <JWT>` header.  
**Content-Type:** `application/json` unless noted otherwise.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Organizations](#2-organizations)
3. [Credits & Billing](#3-credits--billing)
4. [Analytics](#4-analytics)
5. [Agents & AI Engine](#5-agents--ai-engine)
6. [Public Endpoints](#6-public-endpoints)
7. [Next.js API Routes](#7-nextjs-api-routes)

---

## 1. Authentication

### POST `/api/v1/auth/login`

Authenticate a user with email and password.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response (200):**
```json
{
  "token": "<JWT>",
  "name": "John Doe",
  "email": "user@example.com"
}
```

Used by: `lib/auth.ts` — NextAuth CredentialsProvider

---

### POST `/api/v1/auth/onboarding/personal`

Complete personal onboarding for users who do not create an organization.

**Request body:**
```json
{
  "has_organization": false,
  "created_organization": false,
  "org_name": "",
  "platform": "shopify",
  "work_on_multiple_platforms": false,
  "selected_brands": [],
  "size_of_org": "Just me (1)",
  "your_role": "Founder",
  "country": "US",
  "where_you_hear_us": "LinkedIn",
  "preferred_automation_ids": ["sales", "support"],
  "invited_emails": []
}
```

Used by: `app/_store/useOnboardingStore.ts` — `completeOnboarding()`

---

## 2. Organizations

### GET `/api/v1/organizations`

List all organizations the authenticated user belongs to.

**Response (200):**
```json
{
  "organizations": [
    {
      "id": 1,
      "name": "Acme Corp",
      "description": "...",
      "employee_count": 25,
      "user_role": "owner",
      "joined_at": "2024-01-15T10:00:00Z",
      "subscription_plan": "pro",
      "ecommerce_domain": "acme.myshopify.com",
      "industry": "Fashion",
      "company_size": "Medium team (11-50)",
      "website": "https://acme.com",
      "country": "US",
      "city": "New York"
    }
  ]
}
```

Used by: `app/(sidebar)/organization/page.tsx`

---

### POST `/api/v1/organizations`

Create a new organization.

**Request body:**
```json
{
  "name": "Acme Corp",
  "description": "",
  "employee_count": 25,
  "ecommerce_domain": "",
  "industry": "",
  "company_size": "Medium team (11-50)",
  "website": "https://acme.com",
  "country": "US",
  "city": "",
  "address": "",
  "phone_number": "",
  "subscription_plan": "",
  "hear_about_us": "Facebook",
  "work_on_multiple_platforms": false,
  "selected_brands": [],
  "creator_job_title": "Founder"
}
```

**Response (200/201):**
```json
{
  "organization": {
    "id": "42"
  }
}
```

Used by: `app/_store/useOnboardingStore.ts` — `submitOrganization()`

---

### PUT `/api/v1/organizations/{id}`

Update organization details or preferences.

**Path param:** `id` — organization ID

**Request body (preferences update):**
```json
{
  "preferred_automation_ids": ["sales", "support", "inventory"]
}
```

Used by: `app/_store/useOnboardingStore.ts` — `completeOnboarding()`

---

### POST `/api/v1/organizations/{id}/invite`

Invite a user to an organization by email.

**Path param:** `id` — organization ID

**Request body:**
```json
{
  "email": "colleague@example.com",
  "role": "member"
}
```

Used by: `app/(sidebar)/organization/page.tsx`

---

### POST `/api/v1/organizations/{id}/members`

Add a member to an organization (used during onboarding).

**Path param:** `id` — organization ID

**Request body:**
```json
{
  "email": "teammate@example.com",
  "role": "member"
}
```

Used by: `app/_store/useOnboardingStore.ts` — `addMembers()`

---

## 3. Credits & Billing

### GET `/api/v1/credits/overview`

Retrieve the current credits balance and billing cycle.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `organization_id` | string (optional) | Scope credits to an organization |

**Response (200):**
```json
{
  "owner_type": "organization",
  "owner_id": "42",
  "plan": "pro",
  "total_credits": 10000,
  "credits_consumed": 3500,
  "available_credits": 6500,
  "cycle_start": "2024-06-01T00:00:00Z",
  "cycle_end": "2024-06-30T23:59:59Z",
  "status": "active"
}
```

Used by: `lib/credits.ts` — `fetchCreditsOverview()`

---

### GET `/api/v1/credits/entitlements`

Retrieve plan entitlements (feature flags, limits, costs).

**Query params:**
| Param | Type | Description |
|---|---|---|
| `organization_id` | string (optional) | Scope to organization |

**Response (200):**
```json
{
  "plan": "pro",
  "rules": {
    "features": {
      "analytics": true,
      "custom_agents": true
    },
    "limits": {
      "max_agents_per_chat": 5,
      "max_secrets": 20,
      "allowed_models": ["gpt-4o", "claude-3-5-sonnet"],
      "allowed_tools": ["*"]
    },
    "costs": {
      "action_costs": {
        "chat_message": { "base": 10 }
      },
      "model_multipliers": {
        "gpt-4o": 2.0,
        "claude-3-5-sonnet": 1.5
      }
    }
  }
}
```

Used by: `lib/credits.ts` — `fetchCreditsEntitlements()`

---

### GET `/api/v1/credits/records`

Retrieve paginated credit transaction history.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `organization_id` | string | — | Filter by organization |
| `page` | number | 1 | Page number |
| `page_size` | number | 20 | Results per page |

**Response (200):**
```json
{
  "records": [
    {
      "id": "rec_abc",
      "credit_account_id": "acc_xyz",
      "record_type": "consume",
      "credits_delta": -10,
      "total_credits_after": 9990,
      "credits_consumed_after": 10,
      "action_key": "chat_message",
      "created_at": "2024-06-15T14:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

Used by: `lib/credits.ts` — `fetchCreditsRecords()`

---

## 4. Analytics

### GET `/api/v1/analytics/agent/runs`

Retrieve agent run records for a given time range.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `start_time` | string (ISO 8601) | Range start |
| `end_time` | string (ISO 8601) | Range end |

**Response (200):**
```json
{
  "agent_runs": [
    {
      "_id": "run_abc123",
      "agent_identifier": "sales_agent",
      "agent_name": "Sales Agent",
      "u_id": "user_42",
      "org_id": "42",
      "chat_id": "chat_xyz",
      "thread_id": "thread_xyz",
      "message_id": "msg_xyz",
      "tool_calls": ["search_products", "create_draft"],
      "input_tokens": 512,
      "output_tokens": 256,
      "total_tokens": 768,
      "cost": 0.015,
      "model_used": "gpt-4o",
      "provider_used": "openai",
      "duration_ms": 4200,
      "started_at": "2024-06-15T14:30:00Z",
      "ended_at": "2024-06-15T14:30:04Z",
      "created_at": "2024-06-15T14:30:04Z"
    }
  ]
}
```

Used by: `app/_store/useAnalyticsStore.ts`

---

## 5. Agents & AI Engine

### WebSocket `/api/v1/agents/ws`

Persistent WebSocket connection for real-time AI chat.

**Connection URL:** Derived from `NEXT_PUBLIC_API_URL` with `http(s)` → `ws(s)` protocol swap.

**Client → Server message:**
```json
{
  "type": "user_message",
  "content": "What are my top-selling products?",
  "chat_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_urls": [],
  "file_urls": []
}
```

**Server → Client events (streamed):**
```json
{ "type": "token", "content": "Based" }
{ "type": "token", "content": " on" }
{ "type": "tool_call", "name": "get_products", "args": {}, "status": "calling" }
{ "type": "tool_result", "name": "get_products", "data": {...} }
{ "type": "transfer", "from_agent": "orchestrator", "to_agent": "analytics_agent" }
{ "type": "final", "content": "Based on your last 30 days..." }
```

Used by: `app/_store/useWebSocketStore.ts`

---

### GET `/api/v1/public/agents/chats/shared/{token}`

Retrieve a shared chat by its public share token. No authentication required.

**Path param:** `token` — public share token

**Response (200):**
```json
{
  "messages": [
    {
      "data": {
        "type": "human",
        "content": "What are my top products?",
        "image_urls": [],
        "file_urls": []
      }
    },
    {
      "data": {
        "type": "ai",
        "content": "Based on your sales data...",
        "name": "Analytics Agent",
        "tool_calls": []
      }
    }
  ]
}
```

Used by: `app/shared/chat/[token]/page.tsx`

---

## 6. Public Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/public/agents/chats/shared/{token}` | None | Retrieve shared chat for read-only view |

---

## 7. Next.js API Routes

These routes run within the Next.js server (not the external backend).

### POST `/api/upload`

Proxy file uploads to Cloudinary. Keeps Cloudinary credentials off the browser.

**Request:** `multipart/form-data` with one or more `file` fields.

**Response (200):**
```json
{
  "urls": [
    "https://res.cloudinary.com/yourcloud/image/upload/v1234/chat_attachments/file.pdf"
  ]
}
```

**Error (400/500):**
```json
{
  "error": "No files provided"
}
```

### ALL `/api/auth/[...nextauth]`

NextAuth.js handler. Manages sign-in, sign-out, and session callbacks. Not called directly by application code — used internally by NextAuth client helpers.

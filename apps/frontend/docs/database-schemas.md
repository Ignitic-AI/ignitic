# Frontend Data Models & Schemas

This document describes the TypeScript interfaces and Zustand store schemas used throughout the Ignitic AI frontend. These represent the **frontend data layer** — the shapes of data as consumed by the UI, normalized from backend API responses.

---

## Table of Contents

1. [Authentication & Session](#1-authentication--session)
2. [Organization](#2-organization)
3. [Chat & AI Messaging](#3-chat--ai-messaging)
4. [Analytics](#4-analytics)
5. [Credits & Billing](#5-credits--billing)
6. [Onboarding](#6-onboarding)
7. [Agents & Runs](#7-agents--runs)

---

## 1. Authentication & Session

### Session (NextAuth extended)

```typescript
// Augmented by lib/auth.ts callbacks
interface Session {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    token?: string       // Backend JWT access token
    [key: string]: any
  }
  expires: string        // ISO date string
  accessToken?: string   // Alias for user.token
  error?: string         // "TokenExpired" when backend JWT is expired
}
```

### SessionStore (Zustand)

```typescript
// src/app/_store/useSessionStore.ts
interface SessionState {
  currentSession: Session | null
  setSession: (session: Session | null) => void
  clearSession: () => void
}
// Persisted to: sessionStorage (key: 'session-storage')
```

---

## 2. Organization

### Organization

```typescript
// src/app/_store/useorgStore.ts
interface Organization {
  id: string
  name: string
  description: string
  memberCount: number
  role: string                // "owner" | "admin" | "member"
  createdAt: string           // ISO date string
  subscription_plan: string
  ecommerce_domain: string
  industry: string
  company_size: string
  website: string
  country: string
  city: string
  status?: string             // "active" | "inactive" | "pending"
  address?: string
  phone_number?: string
}
```

### Member

```typescript
// src/app/(sidebar)/organization/page.tsx
interface Member {
  id: string
  name: string
  email: string
  role: string                // "owner" | "admin" | "member"
  avatar: string
  joinedAt: string            // ISO date string
  status: string              // "active" | "pending" | "inactive"
  orgId: string
}
```

### OrgStore (Zustand)

```typescript
// src/app/_store/useorgStore.ts
interface OrgState {
  organizations: Organization[]
  currentOrg: Organization | null
  setOrganizations: (orgs: Organization[]) => void
  syncOrganizations: (orgs: Organization[]) => void
  removeOrganization: (orgId: string) => void
  setCurrentOrg: (orgId: string) => void
  clearCurrentOrg: () => void
}
// Persisted to: sessionStorage (key: 'org-storage')
```

### API Response Mapping

The backend API returns organization data in snake_case. The frontend normalizes it:

| Backend field | Frontend field |
|---|---|
| `id` | `id` (coerced to string) |
| `name` | `name` |
| `description` | `description` |
| `employee_count` | `memberCount` |
| `user_role` | `role` |
| `joined_at` | `createdAt` |
| `subscription_plan` | `subscription_plan` |
| `ecommerce_domain` | `ecommerce_domain` |
| `industry` | `industry` |
| `company_size` | `company_size` |
| `website` | `website` |
| `country` | `country` |
| `city` | `city` |

---

## 3. Chat & AI Messaging

### StreamingMessage

```typescript
// src/types/chat.ts
type StreamingMessage = {
  id?: string
  sender: 'user' | 'ai'
  text: string
  content?: string
  agentName?: string
  isStreaming?: boolean
  systemStatus?: string | null
  toolCalls: Array<{
    name: string
    args: Record<string, any>
    status: 'calling' | 'done'
  }>
  toolName?: string
  isFinalResponse?: boolean
  hasThinking?: boolean
  toolData?: any
  isToolDataMessage?: boolean    // True for tool result display
  isTransferMessage?: boolean    // True for agent handoff notification
  image_urls?: string[]
  file_urls?: string[]
  isAgentSpecificResponse?: boolean
}
```

### Message Taxonomy

| Field combination | Rendered as |
|---|---|
| `sender: 'user'` | User message bubble |
| `sender: 'ai'`, `isFinalResponse: true` | AI response bubble with Markdown |
| `isStreaming: true` | AI response with streaming indicator |
| `isToolDataMessage: true` | Collapsible tool result block |
| `isTransferMessage: true` | Agent handoff notification |
| `toolCalls.length > 0` | Inline tool call chips with status |

---

## 4. Analytics

### AgentRun

```typescript
// src/app/_store/useAnalyticsStore.ts
interface AgentRun {
  _id: string
  agent_identifier: string
  agent_name: string
  u_id: string
  org_id: string | null
  chat_id: string
  thread_id: string
  message_id: string
  tool_calls: string[]
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost: number
  model_used: string
  provider_used: string
  duration_ms: number
  started_at: string           // ISO date string
  ended_at: string             // ISO date string
  created_at: string           // ISO date string
}
```

### TokenDataPoint

```typescript
interface TokenDataPoint {
  name: string               // Agent name
  input_tokens: number
  output_tokens: number
  total_tokens: number
}
```

### AnalyticsStore (Zustand)

```typescript
interface AnalyticsState {
  tokenData: TokenDataSet | null
  selectedMetrics: TokenMetricKey[]
  isLoading: boolean
  error: string | null
  fetchTokenData: (startTime: string, endTime: string) => Promise<void>
  toggleMetric: (metric: TokenMetricKey) => void
  clearTokenData: () => void
}
// Not persisted (in-memory only)
```

### Dashboard Widget

```typescript
// src/app/(sidebar)/analytics/analytics-types.ts
interface DashboardWidget {
  id: string
  chartType: 'column' | 'bar' | 'donut' | 'line' | 'number'
  metric: 'agent_runs' | 'run_time_total' | 'avg_run_duration' | 'total_tokens' | 'total_cost' | 'tool_invocations'
  agentScope: string           // "all" or specific agent_identifier
  viewBy: 'hour' | 'day' | 'week' | 'month'
  size: 'small' | 'medium' | 'large' | 'full'
  comparePrevious: boolean
  title: string
  timeRange?: 'dashboard' | 'last_7_days' | 'last_28_days' | 'last_90_days'
}
// Dashboard layout persisted to: localStorage (key: 'ignitic-analytics-dashboard-v1')
```

---

## 5. Credits & Billing

### CreditsOverview

```typescript
// src/lib/credits.ts
interface CreditsOverview {
  owner_type: 'user' | 'organization'
  owner_id: string
  plan: string
  total_credits: number
  credits_consumed: number
  available_credits: number
  cycle_start: string          // ISO date string
  cycle_end: string            // ISO date string
  status: string               // "active" | "inactive" | "suspended"
}
```

### CreditRecord

```typescript
interface CreditRecord {
  id: string
  credit_account_id: string
  record_type: 'consume' | 'grant_system' | 'adjustment' | 'cycle_reset' | 'plan_change' | string
  credits_delta: number
  total_credits_after: number
  credits_consumed_after: number
  action_key?: string
  reference_id?: string
  actor_user_id?: string
  metadata_json?: Record<string, unknown>
  created_at: string
}
```

### EntitlementRules

```typescript
interface EntitlementRules {
  features: Record<string, boolean>
  limits: {
    max_agents_per_chat?: number
    max_secrets?: number
    max_workflow_templates?: number
    allowed_models?: string[]
    allowed_tools?: string[]
    [key: string]: unknown
  }
  costs: {
    action_costs?: Record<string, { base?: number; [key: string]: unknown }>
    model_multipliers?: Record<string, number>
    tool_costs?: Record<string, number>
    [key: string]: unknown
  }
}
```

### ActionAccessResult

```typescript
interface ActionAccessResult {
  allowed: boolean
  reason?: string
  estimatedCost: number
}
```

---

## 6. Onboarding

### OnboardingFormData

```typescript
// src/app/_store/useOnboardingStore.ts
interface OnboardingFormData {
  // Step 1 — Account Setup
  isOrg: boolean
  orgName: string
  platform: string
  workOnMultiplePlatforms: boolean
  selectedBrands: string[]

  // Step 2 — Organization Details
  sizeOfOrg: string            // "Just me (1)" | "Small team (2-10)" | etc.
  yourRole: string
  country: string
  whereYouHearUs: string

  // Step 3 — Invite Members
  invitedEmails: string[]
  emailInput: string

  // Step 4 — Preferences
  automations: string[]

  // Internal
  createdOrgId: string | null  // Set after successful org creation in Step 2
}
// Persisted to: sessionStorage (key: 'onboarding-storage')
```

### Zod Validation Schemas

```typescript
// src/lib/validations.ts
const step1Schema = z.object({
  isOrg: z.boolean(),
  orgName: z.string(),
  platform: z.string(),
  workOnMultiplePlatforms: z.boolean(),
  selectedBrands: z.array(z.string()),
}).refine(data => !data.isOrg || data.orgName.trim().length > 0, {
  message: "Organization Name is Required",
  path: ["orgName"],
})

const step2Schema = z.object({
  sizeOfOrg: z.string().min(1, "Organization size is required"),
  yourRole: z.string().min(1, "Your role is required"),
  country: z.string().min(1, "Country is required"),
  whereYouHearUs: z.string(),
})
```

---

## 7. Agents & Runs

These types are returned from the AI Engine and Backend APIs and consumed by the Agents & Tools page and analytics features.

### AgentRun (Analytics context)

See [Section 4 — Analytics](#4-analytics) for the `AgentRun` interface.

### Organization Create Payload

The payload sent to `POST /api/v1/organizations` during onboarding:

```typescript
interface CreateOrganizationPayload {
  name: string
  description: string
  employee_count: number          // Derived from sizeOfOrg string
  ecommerce_domain: string
  industry: string
  company_size: string
  website: string
  country: string
  city: string
  address: string
  phone_number: string
  subscription_plan: string
  hear_about_us: string
  work_on_multiple_platforms: boolean
  selected_brands: string[]
  creator_job_title: string
}
```

### Personal Onboarding Payload

Sent to `POST /api/v1/auth/onboarding/personal` when the user does not create an org:

```typescript
interface PersonalOnboardingPayload {
  has_organization: boolean
  created_organization: boolean
  org_name: string
  platform: string
  work_on_multiple_platforms: boolean
  selected_brands: string[]
  size_of_org: string
  your_role: string
  country: string
  where_you_hear_us: string
  preferred_automation_ids: string[]
  invited_emails: string[]
}
```

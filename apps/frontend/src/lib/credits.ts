import axios from "axios"

export const API_BASE_URL = "http://localhost:8080"

export type CreditOwnerType = "user" | "organization"

export interface CreditsOverview {
  owner_type: CreditOwnerType
  owner_id: string
  plan: string
  total_credits: number
  credits_consumed: number
  available_credits: number
  cycle_start: string
  cycle_end: string
  status: string
}

export interface CreditRecord {
  id: string
  credit_account_id: string
  record_type: "consume" | "grant_system" | "adjustment" | "cycle_reset" | "plan_change" | string
  credits_delta: number
  total_credits_after: number
  credits_consumed_after: number
  action_key?: string
  reference_id?: string
  actor_user_id?: string
  metadata_json?: Record<string, unknown>
  created_at: string
}

export interface CreditsRecordsResponse {
  records: CreditRecord[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface EntitlementRules {
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

export interface CreditsEntitlements {
  plan: string
  rules: EntitlementRules
}

export interface ActionAccessResult {
  allowed: boolean
  reason?: string
  estimatedCost: number
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
})

export async function fetchCreditsOverview(token: string, organizationId?: string | null) {
  const params = organizationId ? { organization_id: organizationId } : undefined
  const response = await axios.get<CreditsOverview>(`${API_BASE_URL}/api/v1/credits/overview`, {
    headers: authHeaders(token),
    params,
  })
  return response.data
}

export async function fetchCreditsEntitlements(token: string, organizationId?: string | null) {
  const params = organizationId ? { organization_id: organizationId } : undefined
  const response = await axios.get<CreditsEntitlements>(`${API_BASE_URL}/api/v1/credits/entitlements`, {
    headers: authHeaders(token),
    params,
  })
  return response.data
}

export async function fetchCreditsRecords(
  token: string,
  options?: { organizationId?: string | null; page?: number; pageSize?: number }
) {
  const response = await axios.get<CreditsRecordsResponse>(`${API_BASE_URL}/api/v1/credits/records`, {
    headers: authHeaders(token),
    params: {
      organization_id: options?.organizationId || undefined,
      page: options?.page ?? 1,
      page_size: options?.pageSize ?? 20,
    },
  })
  return response.data
}

export const toFriendlyCreditsError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.error
    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return apiMessage
    }
    return error.message || "Unable to load credits"
  }
  return "Unable to load credits"
}

export const featureEnabled = (entitlements: CreditsEntitlements | null, featureKey: string) => {
  if (!entitlements) return true
  return entitlements.rules.features?.[featureKey] !== false
}

export const modelAllowed = (entitlements: CreditsEntitlements | null, modelId: string) => {
  const allowed = entitlements?.rules.limits?.allowed_models
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(modelId)
}

export const toolAllowed = (entitlements: CreditsEntitlements | null, toolName: string) => {
  const allowed = entitlements?.rules.limits?.allowed_tools
  if (!allowed || allowed.length === 0) return true
  if (allowed.includes("*")) return true
  return allowed.includes(toolName)
}

export const calculateEstimatedCost = (
  entitlements: CreditsEntitlements | null,
  actionKey: string,
  modelId?: string
) => {
  const baseCost = entitlements?.rules.costs?.action_costs?.[actionKey]?.base ?? 0
  if (!modelId) return baseCost

  const multiplier = entitlements?.rules.costs?.model_multipliers?.[modelId] ?? 1
  return Math.ceil(baseCost * multiplier)
}

export const canUseAction = (
  overview: CreditsOverview | null,
  entitlements: CreditsEntitlements | null,
  actionKey: string,
  modelId?: string
): ActionAccessResult => {
  const enabled = featureEnabled(entitlements, actionKey)
  const estimatedCost = calculateEstimatedCost(entitlements, actionKey, modelId)

  if (!enabled) {
    return { allowed: false, reason: `Your plan does not include ${actionKey}.`, estimatedCost }
  }

  if (!overview) {
    return { allowed: true, estimatedCost }
  }

  if (overview.status !== "active") {
    return { allowed: false, reason: "Credits account is not active.", estimatedCost }
  }

  if (overview.available_credits <= 0) {
    return { allowed: false, reason: "No credits available for this billing cycle.", estimatedCost }
  }

  if (overview.available_credits < estimatedCost) {
    return {
      allowed: false,
      reason: `Not enough credits. This action needs about ${estimatedCost} credits.`,
      estimatedCost,
    }
  }

  return { allowed: true, estimatedCost }
}

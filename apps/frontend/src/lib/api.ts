const normalizeBaseUrl = (value?: string) => (value ?? "").replace(/\/+$/, "")

export const API_BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL)
export const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`

export const getAgentsWebSocketUrl = () => {
  const baseUrl =
    API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "")

  return `${baseUrl.replace(/^http/i, "ws")}/api/v1/agents/ws`
}

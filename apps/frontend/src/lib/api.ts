const normalizeBaseUrl = (value?: string) => (value ?? "").replace(/\/+$/, "")

// Server-side code (NextAuth, route handlers) may need a different URL than the
// browser, e.g. `http://backend:8080` inside Docker Compose. API_INTERNAL_URL is
// never exposed to the client bundle.
const isServer = typeof window === "undefined"

export const API_BASE_URL = normalizeBaseUrl(
  (isServer && process.env.API_INTERNAL_URL) || process.env.NEXT_PUBLIC_API_URL
)
export const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`

export const getAgentsWebSocketUrl = () => {
  const baseUrl =
    API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "")

  return `${baseUrl.replace(/^http/i, "ws")}/api/v1/agents/ws`
}

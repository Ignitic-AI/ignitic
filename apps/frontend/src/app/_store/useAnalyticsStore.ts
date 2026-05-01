import { create } from 'zustand'
import axios from 'axios'
import { useSessionStore } from './useSessionStore'
import { API_V1_BASE_URL } from '@/lib/api'

export interface AgentRun {
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
  started_at: string
  ended_at: string
  created_at: string
}

export interface TokenDataPoint {
  name: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export type TokenMetricKey = 'input_tokens' | 'output_tokens' | 'total_tokens'

export interface TokenDataSet {
  label: string
  data: TokenDataPoint[]
  color: string
  startTime: string
  endTime: string
  fetchedAt: number
}

interface AnalyticsState {
  tokenData: TokenDataSet | null
  selectedMetrics: TokenMetricKey[]
  isLoading: boolean
  error: string | null
  fetchTokenData: (startTime: string, endTime: string) => Promise<void>
  toggleMetric: (metric: TokenMetricKey) => void
  clearTokenData: () => void
}

export const useAnalyticsStore = create<AnalyticsState>()((set, get) => ({
  tokenData: null,
  selectedMetrics: ['input_tokens', 'output_tokens', 'total_tokens'] as TokenMetricKey[],
  isLoading: false,
  error: null,

  toggleMetric: (metric: TokenMetricKey) => {
    const current = get().selectedMetrics
    if (current.includes(metric)) {
      // Don't allow deselecting all - keep at least one
      if (current.length > 1) {
        set({ selectedMetrics: current.filter((m) => m !== metric) })
      }
    } else {
      set({ selectedMetrics: [...current, metric] })
    }
  },

  fetchTokenData: async (startTime: string, endTime: string) => {
    set({ isLoading: true, error: null })

    try {
      const session = useSessionStore.getState().currentSession
      const token = session?.user?.token

      if (!token) {
        set({ isLoading: false, error: 'Not authenticated' })
        return
      }

      const params = new URLSearchParams()
      if (startTime) params.append('start_time', startTime)
      if (endTime) params.append('end_time', endTime)

      const response = await axios.get(
        `${API_V1_BASE_URL}/analytics/agent/runs?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const runs: AgentRun[] = response.data.agent_runs || []

      // Aggregate tokens per agent
      const agentMap = new Map<string, { input: number; output: number; total: number }>()

      for (const run of runs) {
        const name = run.agent_name || run.agent_identifier
        const existing = agentMap.get(name) || { input: 0, output: 0, total: 0 }
        existing.input += run.input_tokens
        existing.output += run.output_tokens
        existing.total += run.total_tokens
        agentMap.set(name, existing)
      }

      const data: TokenDataPoint[] = Array.from(agentMap.entries()).map(
        ([name, tokens]) => ({
          name,
          input_tokens: tokens.input,
          output_tokens: tokens.output,
          total_tokens: tokens.total,
        })
      )

      set({
        tokenData: {
          label: 'Token Usage',
          data,
          color: 'hsl(var(--chart-5))',
          startTime,
          endTime,
          fetchedAt: Date.now(),
        },
        isLoading: false,
        error: null,
      })
    } catch (err: any) {
      const message =
        err?.response?.data?.detail || err?.message || 'Failed to fetch token data'
      set({ isLoading: false, error: message })
    }
  },

  clearTokenData: () => set({ tokenData: null, error: null }),
}))

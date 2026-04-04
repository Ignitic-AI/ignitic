"use client"

import { useSessionStore } from "@/app/_store/useSessionStore"
import { useCallback, useEffect, useState } from "react"
import type {
  AnalyticsMetricId,
  AnalyticsViewBy,
  DashboardWidget,
  WidgetTimeRange,
} from "./analytics-types"

const API_BASE_URL = "http://localhost:8080"
const PRIMARY = "#0056D2"

export interface AgentRunRow {
  agent_identifier: string
  agent_name: string
  duration_ms: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  cost: number
  created_at: string
}

export interface ToolExecutionRow {
  ignitic_identifier: string
  created_at: string
}

export interface TimeBucketPoint {
  key: string
  label: string
  value: number
  valuePrev?: number
}

function startOfBucket(d: Date, viewBy: AnalyticsViewBy): Date {
  const x = new Date(d)
  if (viewBy === "hour") {
    x.setMinutes(0, 0, 0)
    return x
  }
  if (viewBy === "day") {
    x.setHours(0, 0, 0, 0)
    return x
  }
  if (viewBy === "week") {
    const day = x.getDay()
    const diff = (day + 6) % 7
    x.setDate(x.getDate() - diff)
    x.setHours(0, 0, 0, 0)
    return x
  }
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}

function bucketLabel(d: Date, viewBy: AnalyticsViewBy): string {
  if (viewBy === "hour")
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })
  if (viewBy === "day") return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  if (viewBy === "week") {
    const end = new Date(d)
    end.setDate(end.getDate() + 6)
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
}

function nextBucket(d: Date, viewBy: AnalyticsViewBy): Date {
  const x = new Date(d)
  if (viewBy === "hour") {
    x.setHours(x.getHours() + 1)
    return x
  }
  if (viewBy === "day") {
    x.setDate(x.getDate() + 1)
    return x
  }
  if (viewBy === "week") {
    x.setDate(x.getDate() + 7)
    return x
  }
  x.setMonth(x.getMonth() + 1)
  return x
}

const ROLLING_DAYS: Record<Exclude<WidgetTimeRange, "dashboard">, number> = {
  last_7_days: 7,
  last_28_days: 28,
  last_90_days: 90,
}

/**
 * Effective [start, end] for a widget. Rolling ranges end at local today 23:59:59.999.
 */
export function resolveWidgetTimeRange(
  timeRange: WidgetTimeRange | undefined,
  dashboardStart: Date,
  dashboardEnd: Date
): { start: Date; end: Date } {
  const mode: WidgetTimeRange = timeRange ?? "dashboard"
  if (mode === "dashboard") {
    return { start: new Date(dashboardStart), end: new Date(dashboardEnd) }
  }
  const days = ROLLING_DAYS[mode]
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

/** Union of all widget windows and the dashboard range so one fetch covers every widget. */
export function computeFetchWindow(
  widgets: DashboardWidget[],
  dashboardStart: Date,
  dashboardEnd: Date
): { start: Date; end: Date } {
  if (!widgets.length) {
    return { start: new Date(dashboardStart), end: new Date(dashboardEnd) }
  }
  let minT = dashboardStart.getTime()
  let maxT = dashboardEnd.getTime()
  for (const w of widgets) {
    const { start, end } = resolveWidgetTimeRange(w.timeRange, dashboardStart, dashboardEnd)
    minT = Math.min(minT, start.getTime())
    maxT = Math.max(maxT, end.getTime())
  }
  return { start: new Date(minT), end: new Date(maxT) }
}

export function matchesAgentScope(
  igniticIdentifier: string,
  agentScope: string
): boolean {
  if (agentScope === "all") return true
  const needle = `tools.${agentScope}.`
  if (igniticIdentifier.includes(needle)) return true
  const wf = `workflows.n8n.${agentScope}.`
  return igniticIdentifier.startsWith(wf)
}

async function fetchAllJsonPages(
  path: string,
  token: string,
  listKey: string,
  extraParams: Record<string, string>
): Promise<unknown[]> {
  const acc: unknown[] = []
  let page = 1
  const page_size = "100"
  let total_pages = 1
  do {
    const params = new URLSearchParams({
      ...extraParams,
      page: String(page),
      page_size,
    })
    const res = await fetch(`${API_BASE_URL}${path}?${params}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    const body = (await res.json()) as Record<string, unknown>
    const list = body[listKey]
    const chunk = Array.isArray(list) ? list : []
    acc.push(...chunk)
    total_pages = typeof body.total_pages === "number" ? body.total_pages : 1
    page += 1
    if (page > 80) break
  } while (page <= total_pages)
  return acc
}

export function useDashboardData(start: Date, end: Date) {
  const session = useSessionStore((s) => s.currentSession)
  const token = session?.user?.token ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<AgentRunRow[]>([])
  const [tools, setTools] = useState<ToolExecutionRow[]>([])

  const load = useCallback(async () => {
    if (!token) {
      setRuns([])
      setTools([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const startIso = start.toISOString()
      const endIso = end.toISOString()

      const runsRaw = (await fetchAllJsonPages("/api/v1/analytics/agent/runs", token, "agent_runs", {
        start_date: startIso,
        end_date: endIso,
      })) as AgentRunRow[]

      let toolsRaw: ToolExecutionRow[] = []
      try {
        toolsRaw = (await fetchAllJsonPages(
          "/api/v1/analytics/tool/executions",
          token,
          "executions",
          { start_date: startIso, end_date: endIso }
        )) as ToolExecutionRow[]
      } catch {
        toolsRaw = []
      }

      setRuns(runsRaw)
      setTools(toolsRaw)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics")
      setRuns([])
      setTools([])
    } finally {
      setLoading(false)
    }
  }, [token, start, end])

  useEffect(() => {
    void load()
  }, [load])

  return { loading, error, runs, tools, reload: load, token }
}

export function getAgentOptions(runs: AgentRunRow[]): { id: string; label: string }[] {
  const m = new Map<string, string>()
  for (const r of runs) {
    if (!m.has(r.agent_identifier)) m.set(r.agent_identifier, r.agent_name || r.agent_identifier)
  }
  return [{ id: "all", label: "All agents" }, ...Array.from(m.entries()).map(([id, label]) => ({ id, label }))]
}

function filterRuns(runs: AgentRunRow[], agentScope: string): AgentRunRow[] {
  if (agentScope === "all") return runs
  return runs.filter((r) => r.agent_identifier === agentScope)
}

function filterTools(tools: ToolExecutionRow[], agentScope: string): ToolExecutionRow[] {
  if (agentScope === "all") return tools
  return tools.filter((t) => matchesAgentScope(t.ignitic_identifier, agentScope))
}

function valueForRunMetric(metric: AnalyticsMetricId, list: AgentRunRow[]): number {
  if (metric === "agent_runs") return list.length
  if (metric === "run_time_total") return list.reduce((s, r) => s + r.duration_ms, 0) / 1000
  if (metric === "avg_run_duration") {
    if (!list.length) return 0
    return list.reduce((s, r) => s + r.duration_ms, 0) / list.length
  }
  if (metric === "total_tokens") return list.reduce((s, r) => s + r.total_tokens, 0)
  if (metric === "total_cost") return list.reduce((s, r) => s + r.cost, 0)
  return 0
}

function valueForToolMetric(metric: AnalyticsMetricId, list: ToolExecutionRow[]): number {
  if (metric === "tool_invocations") return list.length
  return 0
}

export function formatMetricNumber(metric: AnalyticsMetricId, value: number): string {
  if (metric === "run_time_total") {
    if (value >= 3600) return `${(value / 3600).toFixed(1)}h`
    if (value >= 60) return `${(value / 60).toFixed(1)}m`
    return `${Math.round(value)}s`
  }
  if (metric === "avg_run_duration") return `${Math.round(value)}ms`
  if (metric === "total_cost") return value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)
  if (metric === "total_tokens") return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value.toLocaleString()
  return String(Math.round(value))
}

export function aggregateSeries(
  runs: AgentRunRow[],
  tools: ToolExecutionRow[],
  metric: AnalyticsMetricId,
  agentScope: string,
  viewBy: AnalyticsViewBy,
  rangeStart: Date,
  rangeEnd: Date,
  comparePrevious: boolean
): TimeBucketPoint[] {
  const fr = filterRuns(runs, agentScope)
  const ft = filterTools(tools, agentScope)

  const msRange = rangeEnd.getTime() - rangeStart.getTime()

  const buckets: TimeBucketPoint[] = []
  let cursor = startOfBucket(new Date(rangeStart), viewBy)
  const endCap = new Date(rangeEnd)
  endCap.setHours(23, 59, 59, 999)

  while (cursor <= endCap) {
    const next = nextBucket(cursor, viewBy)
    const label = bucketLabel(cursor, viewBy)
    const key = cursor.toISOString()

    const runsIn = fr.filter((r) => {
      const t = new Date(r.created_at).getTime()
      return t >= cursor.getTime() && t < next.getTime()
    })

    let value = 0
    if (metric === "tool_invocations") {
      const toolsIn = ft.filter((x) => {
        const t = new Date(x.created_at).getTime()
        return t >= cursor.getTime() && t < next.getTime()
      })
      value = toolsIn.length
    } else if (metric === "agent_runs") {
      value = runsIn.length
    } else if (metric === "run_time_total") {
      value = runsIn.reduce((s, r) => s + r.duration_ms, 0) / 1000
    } else if (metric === "avg_run_duration") {
      value = runsIn.length ? runsIn.reduce((s, r) => s + r.duration_ms, 0) / runsIn.length : 0
    } else if (metric === "total_tokens") {
      value = runsIn.reduce((s, r) => s + r.total_tokens, 0)
    } else if (metric === "total_cost") {
      value = runsIn.reduce((s, r) => s + r.cost, 0)
    }

    let valuePrev: number | undefined
    if (comparePrevious) {
      const pc = new Date(cursor.getTime() - msRange)
      const pn = new Date(next.getTime() - msRange)
      const runsPrev = fr.filter((r) => {
        const t = new Date(r.created_at).getTime()
        return t >= pc.getTime() && t < pn.getTime()
      })
      if (metric === "tool_invocations") {
        const toolsPrev = ft.filter((x) => {
          const t = new Date(x.created_at).getTime()
          return t >= pc.getTime() && t < pn.getTime()
        })
        valuePrev = toolsPrev.length
      } else if (metric === "agent_runs") valuePrev = runsPrev.length
      else if (metric === "run_time_total")
        valuePrev = runsPrev.reduce((s, r) => s + r.duration_ms, 0) / 1000
      else if (metric === "avg_run_duration")
        valuePrev = runsPrev.length
          ? runsPrev.reduce((s, r) => s + r.duration_ms, 0) / runsPrev.length
          : 0
      else if (metric === "total_tokens") valuePrev = runsPrev.reduce((s, r) => s + r.total_tokens, 0)
      else if (metric === "total_cost") valuePrev = runsPrev.reduce((s, r) => s + r.cost, 0)
    }

    buckets.push({ key, label, value, valuePrev })

    cursor = next
    if (buckets.length > 500) break
  }

  return buckets
}

export function scalarValue(
  runs: AgentRunRow[],
  tools: ToolExecutionRow[],
  metric: AnalyticsMetricId,
  agentScope: string,
  comparePrevious: boolean,
  rangeStart: Date,
  rangeEnd: Date
): { current: number; previous?: number } {
  const rs = rangeStart.getTime()
  const re = rangeEnd.getTime()
  const fr = filterRuns(runs, agentScope).filter((r) => {
    const t = new Date(r.created_at).getTime()
    return t >= rs && t <= re
  })
  const ft = filterTools(tools, agentScope).filter((x) => {
    const t = new Date(x.created_at).getTime()
    return t >= rs && t <= re
  })
  const msRange = rangeEnd.getTime() - rangeStart.getTime()
  const prevStart = new Date(rangeStart.getTime() - msRange)
  const prevEnd = new Date(rangeStart.getTime())

  let current = 0
  if (metric === "tool_invocations") current = valueForToolMetric(metric, ft)
  else current = valueForRunMetric(metric, fr)

  if (!comparePrevious) return { current }

  const frP = fr.filter((r) => {
    const t = new Date(r.created_at).getTime()
    return t >= prevStart.getTime() && t < prevEnd.getTime()
  })
  const ftP = ft.filter((x) => {
    const t = new Date(x.created_at).getTime()
    return t >= prevStart.getTime() && t < prevEnd.getTime()
  })

  let previous = 0
  if (metric === "tool_invocations") previous = ftP.length
  else previous = valueForRunMetric(metric, frP)

  return { current, previous }
}

export { PRIMARY }

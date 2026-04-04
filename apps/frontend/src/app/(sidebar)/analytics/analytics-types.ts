export type AnalyticsChartType = "column" | "bar" | "donut" | "line" | "number"

export type AnalyticsMetricId =
  | "agent_runs"
  | "run_time_total"
  | "avg_run_duration"
  | "total_tokens"
  | "total_cost"
  | "tool_invocations"

export type AnalyticsViewBy = "hour" | "day" | "week" | "month"

export type WidgetSize = "small" | "medium" | "large" | "full"


export type WidgetTimeRange = "dashboard" | "last_7_days" | "last_28_days" | "last_90_days"

export interface DashboardWidget {
  id: string
  chartType: AnalyticsChartType
  metric: AnalyticsMetricId
  agentScope: string
  viewBy: AnalyticsViewBy
  size: WidgetSize
  comparePrevious: boolean
  title: string
  timeRange?: WidgetTimeRange
}

export const WIDGET_TIME_RANGE_LABELS: Record<WidgetTimeRange, string> = {
  dashboard: "Same as dashboard",
  last_7_days: "Last 7 days",
  last_28_days: "Last 28 days",
  last_90_days: "Last 90 days",
}

export const METRIC_LABELS: Record<AnalyticsMetricId, string> = {
  agent_runs: "Agent runs",
  run_time_total: "Total run time",
  avg_run_duration: "Avg. run duration",
  total_tokens: "Tokens used",
  total_cost: "Estimated AI cost (USD)",
  tool_invocations: "Tool & workflow runs",
}

/** Legacy keys from earlier dashboard versions (pre e-commerce wording). */
const LEGACY_METRIC: Record<string, AnalyticsMetricId> = {
  call_counts: "agent_runs",
  call_duration: "run_time_total",
  call_latency: "avg_run_duration",
}

const LEGACY_TITLE: Record<string, string> = {
  "Call counts": METRIC_LABELS.agent_runs,
  "Call duration": METRIC_LABELS.run_time_total,
  "Call latency": METRIC_LABELS.avg_run_duration,
}

const VALID_SIZES = new Set<string>(["small", "medium", "large", "full"])
const VALID_TIME_RANGES = new Set<string>(["dashboard", "last_7_days", "last_28_days", "last_90_days"])

export function migrateStoredWidget(raw: DashboardWidget): DashboardWidget {
  const legacyMetric = raw.metric as string
  const metric = LEGACY_METRIC[legacyMetric] ?? (raw.metric as AnalyticsMetricId)
  let title = raw.title
  if (LEGACY_TITLE[title]) title = LEGACY_TITLE[title]
  const size = VALID_SIZES.has(raw.size as string) ? raw.size : "medium"
  const timeRange: WidgetTimeRange =
    raw.timeRange && VALID_TIME_RANGES.has(raw.timeRange) ? raw.timeRange : "dashboard"
  return {
    id: raw.id,
    chartType: raw.chartType,
    metric,
    agentScope: raw.agentScope,
    viewBy: raw.viewBy,
    size,
    comparePrevious: raw.comparePrevious,
    title,
    timeRange,
  }
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: "w1",
    chartType: "number",
    metric: "agent_runs",
    agentScope: "all",
    viewBy: "day",
    size: "small",
    comparePrevious: false,
    title: "Agent runs",
    timeRange: "dashboard",
  },
  {
    id: "w2",
    chartType: "number",
    metric: "run_time_total",
    agentScope: "all",
    viewBy: "day",
    size: "small",
    comparePrevious: false,
    title: "Total run time",
    timeRange: "dashboard",
  },
  {
    id: "w3",
    chartType: "number",
    metric: "avg_run_duration",
    agentScope: "all",
    viewBy: "day",
    size: "small",
    comparePrevious: false,
    title: "Avg. run duration",
    timeRange: "dashboard",
  },
  {
    id: "w4",
    chartType: "line",
    metric: "agent_runs",
    agentScope: "all",
    viewBy: "day",
    size: "large",
    comparePrevious: false,
    title: "Agent runs",
    timeRange: "dashboard",
  },
  {
    id: "w5",
    chartType: "line",
    metric: "tool_invocations",
    agentScope: "all",
    viewBy: "day",
    size: "medium",
    comparePrevious: false,
    title: "Tool & workflow runs",
    timeRange: "dashboard",
  },
]

export const DASHBOARD_STORAGE_KEY = "ignitic-analytics-dashboard-v1"

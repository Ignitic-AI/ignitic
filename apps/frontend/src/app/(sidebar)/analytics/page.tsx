"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  BarChart3,
  CalendarDays,
  Check,
  Filter,
  GripVertical,
  Hash,
  LineChart as LineChartIcon,
  Loader2,
  Pencil,
  PieChart as PieChartIcon,
  Plus,
  Maximize2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useCredits } from "@/context/credits-context"
import { CreditsBlockedState } from "@/components/credits/CreditsBlockedState"
import {
  DEFAULT_WIDGETS,
  DASHBOARD_STORAGE_KEY,
  METRIC_LABELS,
  WIDGET_TIME_RANGE_LABELS,
  migrateStoredWidget,
  type AnalyticsChartType,
  type AnalyticsMetricId,
  type AnalyticsViewBy,
  type DashboardWidget,
  type WidgetSize,
  type WidgetTimeRange,
} from "./analytics-types"
import {
  aggregateSeries,
  computeFetchWindow,
  formatMetricNumber,
  getAgentOptions,
  matchesAgentScope,
  PRIMARY,
  resolveWidgetTimeRange,
  scalarValue,
  useDashboardData,
  type AgentRunRow,
  type ToolExecutionRow,
} from "./use-dashboard-data"

function rangeLabel(start: Date, end: Date): string {
  const a = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  const b = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  return `${a} – ${b}`
}

function defaultRange(): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - 27)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function loadWidgets(): DashboardWidget[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY)
    if (!raw) return DEFAULT_WIDGETS
    const parsed = JSON.parse(raw) as DashboardWidget[]
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_WIDGETS
    return parsed.map(migrateStoredWidget)
  } catch {
    return DEFAULT_WIDGETS
  }
}

function saveWidgets(w: DashboardWidget[]) {
  try {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(w))
  } catch {
    /* ignore */
  }
}

const CHART_TYPES: { id: AnalyticsChartType; icon: React.ReactNode; label: string }[] = [
  { id: "column", icon: <BarChart3 className="h-6 w-6" />, label: "Column" },
  { id: "bar", icon: <BarChart3 className="h-6 w-6 rotate-90" />, label: "Bar" },
  { id: "donut", icon: <PieChartIcon className="h-6 w-6" />, label: "Donut" },
  { id: "line", icon: <LineChartIcon className="h-6 w-6" />, label: "Line" },
  { id: "number", icon: <Hash className="h-6 w-6" />, label: "Number" },
]

const METRIC_OPTIONS: AnalyticsMetricId[] = [
  "agent_runs",
  "run_time_total",
  "avg_run_duration",
  "total_tokens",
  "total_cost",
  "tool_invocations",
]

const WIDGET_SIZE_OPTIONS: { id: WidgetSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
  { id: "full", label: "Full width" },
]

function agentLabel(options: { id: string; label: string }[], id: string): string {
  return options.find((a) => a.id === id)?.label ?? id
}

function donutByAgent(runs: AgentRunRow[], agentScope: string): { name: string; value: number }[] {
  if (agentScope !== "all") {
    return [
      {
        name: agentLabel(getAgentOptions(runs), agentScope),
        value: runs.filter((r) => r.agent_identifier === agentScope).length,
      },
    ]
  }
  const m = new Map<string, number>()
  for (const r of runs) {
    const name = r.agent_name || r.agent_identifier
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function donutByTool(tools: ToolExecutionRow[], agentScope: string): { name: string; value: number }[] {
  const ft =
    agentScope === "all" ? tools : tools.filter((t) => matchesAgentScope(t.ignitic_identifier, agentScope))
  const m = new Map<string, number>()
  for (const t of ft) {
    const parts = t.ignitic_identifier.split(".")
    const name = parts.length >= 3 ? parts.slice(0, 3).join(".") : t.ignitic_identifier
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

type ChartPaneMode = "embedded" | "fullscreen"

function WidgetChartPane({
  widget,
  runs,
  tools,
  scope,
  rangeStart,
  rangeEnd,
  mode,
}: {
  widget: DashboardWidget
  runs: AgentRunRow[]
  tools: ToolExecutionRow[]
  scope: string
  rangeStart: Date
  rangeEnd: Date
  mode: ChartPaneMode
}) {
  const series = useMemo(
    () =>
      aggregateSeries(
        runs,
        tools,
        widget.metric,
        scope,
        widget.viewBy,
        rangeStart,
        rangeEnd,
        widget.comparePrevious
      ),
    [runs, tools, widget, scope, rangeStart, rangeEnd]
  )

  const scalar = useMemo(
    () =>
      scalarValue(runs, tools, widget.metric, scope, widget.comparePrevious, rangeStart, rangeEnd),
    [runs, tools, widget.metric, scope, widget.comparePrevious, rangeStart, rangeEnd]
  )

  const donutData = useMemo(() => {
    if (widget.chartType !== "donut") return []
    const rs = rangeStart.getTime()
    const re = rangeEnd.getTime()
    const runsR = runs.filter((r) => {
      const t = new Date(r.created_at).getTime()
      return t >= rs && t <= re
    })
    const toolsR = tools.filter((x) => {
      const t = new Date(x.created_at).getTime()
      return t >= rs && t <= re
    })
    if (widget.metric === "tool_invocations") return donutByTool(toolsR, scope)
    const scopedRuns = scope === "all" ? runsR : runsR.filter((r) => r.agent_identifier === scope)
    return donutByAgent(scopedRuns, scope)
  }, [widget.chartType, widget.metric, runs, tools, scope, rangeStart, rangeEnd])

  const chartData = series.map((p) => ({
    ...p,
    previous: p.valuePrev,
  }))

  const PRIMARY = "var(--color-primary-lm)"
  const colors = [PRIMARY, "#94a3b8", "#0ea5e9", "#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6"]

  const isFs = mode === "fullscreen"
  const chartH = isFs
    ? "h-[min(80vh,900px)] min-h-[340px] w-full"
    : widget.size === "full"
      ? "min-h-[280px] h-[min(360px,45vh)] w-full"
      : "h-[240px] w-full"
  const donutH = isFs
    ? "h-[min(70vh,720px)] min-h-[320px] w-full"
    : widget.size === "full"
      ? "min-h-[260px] h-[min(340px,40vh)] w-full"
      : "h-[220px] w-full"

  const donutInner = isFs ? 130 : 56
  const donutOuter = isFs ? 200 : 88
  const axisTick = isFs ? 13 : 10
  const yAxisW = isFs ? 56 : 40

  if (widget.chartType === "number") {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <p
          className={cn(
            "text-center font-bold tracking-tight text-text-lm dark:text-text",
            isFs ? "text-5xl sm:text-6xl md:text-7xl" : widget.size === "full" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"
          )}
        >
          {formatMetricNumber(widget.metric, scalar.current)}
        </p>
        {widget.comparePrevious && scalar.previous != null && (
          <p className="mt-4 text-sm text-text-muted-lm dark:text-text-muted">
            Previous period: {formatMetricNumber(widget.metric, scalar.previous)}
          </p>
        )}
      </div>
    )
  }

  if (widget.chartType === "donut" && donutData.length) {
    return (
      <div className={cn("w-full", donutH)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              innerRadius={donutInner}
              outerRadius={donutOuter}
              paddingAngle={2}
            >
              {donutData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={isFs ? { fontSize: 14 } : undefined} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.chartType === "line") {
    return (
      <div className={cn("min-h-[200px] w-full", chartH)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={
              isFs ? { top: 16, right: 28, left: 16, bottom: 20 } : { top: 12, right: 16, left: 8, bottom: 8 }
            }
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: axisTick }} className="text-text-muted-lm dark:text-text-muted" />
            <YAxis tick={{ fontSize: axisTick }} width={yAxisW} className="text-text-muted-lm dark:text-text-muted" />
            <Tooltip />
            <Legend wrapperStyle={isFs ? { fontSize: 14 } : undefined} />
            <Line
              type="monotone"
              dataKey="value"
              name={METRIC_LABELS[widget.metric]}
              stroke={PRIMARY}
              strokeWidth={isFs ? 2.5 : 2}
              dot={false}
            />
            {widget.comparePrevious && (
              <Line
                type="monotone"
                dataKey="previous"
                name="Previous period"
                stroke="#94a3b8"
                strokeWidth={isFs ? 2.5 : 2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.chartType === "column") {
    return (
      <div className={cn("w-full", chartH)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={
              isFs ? { top: 16, right: 28, left: 16, bottom: 20 } : { top: 12, right: 16, left: 8, bottom: 8 }
            }
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: axisTick }} />
            <YAxis tick={{ fontSize: axisTick }} width={yAxisW} />
            <Tooltip />
            <Legend wrapperStyle={isFs ? { fontSize: 14 } : undefined} />
            <Bar dataKey="value" name={METRIC_LABELS[widget.metric]} fill={PRIMARY} radius={[6, 6, 0, 0]} />
            {widget.comparePrevious && (
              <Bar dataKey="previous" name="Previous period" fill="#94a3b8" radius={[6, 6, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className={cn("w-full", chartH)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={
            isFs
              ? { top: 16, right: 32, left: 24, bottom: 20 }
              : { top: 12, right: 16, left: 8, bottom: 8 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis type="number" tick={{ fontSize: axisTick }} />
          <YAxis type="category" dataKey="label" width={isFs ? 140 : 100} tick={{ fontSize: isFs ? 11 : 9 }} />
          <Tooltip />
          <Bar dataKey="value" name={METRIC_LABELS[widget.metric]} fill={PRIMARY} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AnalyticsPage() {
  const { hasFeature } = useCredits()
  const analyticsEnabled = hasFeature("analytics.agent_runs") || hasFeature("analytics.agent_usage")

  const [{ start, end }, setRange] = useState(defaultRange)
  const [rangeDraft, setRangeDraft] = useState(() => {
    const r = defaultRange()
    return {
      startStr: r.start.toISOString().slice(0, 10),
      endStr: r.end.toISOString().slice(0, 10),
    }
  })
  const [rangeOpen, setRangeOpen] = useState(false)
  const [globalAgent, setGlobalAgent] = useState("all")
  const [editMode, setEditMode] = useState(false)
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS)
  const [addOpen, setAddOpen] = useState(false)
  const [fullscreenWidgetId, setFullscreenWidgetId] = useState<string | null>(null)

  const fullscreenWidget = useMemo(
    () => widgets.find((w) => w.id === fullscreenWidgetId) ?? null,
    [widgets, fullscreenWidgetId]
  )

  const fullscreenRange = useMemo(() => {
    if (!fullscreenWidget) return null
    return resolveWidgetTimeRange(fullscreenWidget.timeRange, start, end)
  }, [fullscreenWidget, start, end])

  const fetchWindow = useMemo(() => computeFetchWindow(widgets, start, end), [widgets, start, end])
  const { loading, error, runs, tools } = useDashboardData(fetchWindow.start, fetchWindow.end)

  useEffect(() => {
    setWidgets(loadWidgets())
  }, [])

  useEffect(() => {
    saveWidgets(widgets)
  }, [widgets])

  const agentOptions = useMemo(() => getAgentOptions(runs), [runs])

  const applyRange = () => {
    const s = new Date(rangeDraft.startStr + "T00:00:00")
    const e = new Date(rangeDraft.endStr + "T23:59:59.999")
    if (s >= e) return
    setRange({ start: s, end: e })
    setRangeOpen(false)
  }

  const resetAll = () => {
    setGlobalAgent("all")
    const r = defaultRange()
    setRange(r)
    setRangeDraft({
      startStr: r.start.toISOString().slice(0, 10),
      endStr: r.end.toISOString().slice(0, 10),
    })
    setWidgets([...DEFAULT_WIDGETS])
    saveWidgets(DEFAULT_WIDGETS)
  }

  const removeWidget = (id: string) => {
    setWidgets((w) => w.filter((x) => x.id !== id))
  }

  const WIDGET_DND_MIME = "application/x-ignitic-widget-id"

  const onDragOverRow = (e: React.DragEvent) => {
    e.preventDefault()
    const types = Array.from(e.dataTransfer.types ?? [])
    if (types.includes(WIDGET_DND_MIME) || types.includes("text/plain")) {
      e.dataTransfer.dropEffect = "move"
    }
  }

  const onDropOnWidget = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId =
      e.dataTransfer.getData(WIDGET_DND_MIME) || e.dataTransfer.getData("text/plain")
    if (!sourceId || sourceId === targetId) return
    setWidgets((prev) => {
      const i = prev.findIndex((w) => w.id === sourceId)
      const j = prev.findIndex((w) => w.id === targetId)
      if (i < 0 || j < 0) return prev
      const next = [...prev]
      const [item] = next.splice(i, 1)
      next.splice(j, 0, item)
      return next
    })
  }

  const colClass = (size: WidgetSize) =>
    cn(
      size === "small" && "md:col-span-4",
      size === "medium" && "md:col-span-6",
      size === "large" && "md:col-span-8",
      size === "full" && "md:col-span-12"
    )

  if (!analyticsEnabled) {
    return (
      <CreditsBlockedState
        title="Analytics unavailable"
        message="Your current plan does not include analytics access in this scope."
      />
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col bg-transparent py-8 font-generalSans">
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted-lm dark:text-text-muted">
              Insights
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-lm dark:text-text sm:text-4xl">
              Analytics
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted-lm dark:text-text-muted">
              Store and automation activity: agent runs, time spent in runs, model usage, cost, and tool or workflow
              executions. Build a layout that fits how your team works.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu open={rangeOpen} onOpenChange={setRangeOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-zinc-200 bg-bg-light-lm px-4 dark:border-zinc-800 dark:bg-bg-light"
                >
                  <CalendarDays className="mr-2 h-4 w-4 text-text-muted-lm dark:text-text-muted" />
                  {rangeLabel(start, end)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 p-4 font-manrope" align="end">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Custom range</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-600">From</Label>
                    <input
                      type="date"
                      value={rangeDraft.startStr}
                      onChange={(e) => setRangeDraft((d) => ({ ...d, startStr: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-text-muted-lm dark:text-text-muted">To</Label>
                    <input
                      type="date"
                      value={rangeDraft.endStr}
                      onChange={(e) => setRangeDraft((d) => ({ ...d, endStr: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-bg-light-lm px-2 text-sm dark:border-zinc-800 dark:bg-bg-light"
                    />
                  </div>
                  <Button className="w-full rounded-xl font-semibold text-white bg-primary-lm dark:bg-primary" onClick={applyRange}>
                    Apply range
                  </Button>
                </div>
                <DropdownMenuItem
                  className="mt-2 cursor-pointer"
                  onClick={() => {
                    const r = defaultRange()
                    setRangeDraft({
                      startStr: r.start.toISOString().slice(0, 10),
                      endStr: r.end.toISOString().slice(0, 10),
                    })
                  }}
                >
                  Reset to last ~4 weeks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-generalSans">
                <p className="px-2 py-1.5 text-xs font-semibold text-text-muted-lm dark:text-text-muted">Scope (quick)</p>
                {agentOptions.map((a) => (
                  <DropdownMenuItem key={a.id} className="cursor-pointer" onClick={() => setGlobalAgent(a.id)}>
                    {a.label}
                    {globalAgent === a.id ? " ✓" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={resetAll}
              className="text-sm font-medium text-text-muted-lm underline-offset-4 hover:text-[#0056D2] hover:underline dark:text-text-muted"
            >
              Reset
            </button>

            <Button
              variant="outline"
              className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>

            <Button
              className="h-11 rounded-xl px-5 font-semibold text-white shadow-md bg-primary-lm dark:bg-primary"
              onClick={() => setEditMode((e) => !e)}
            >
              {editMode ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary-lm dark:text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-3 sm:gap-4">
            {widgets.map((w) => (
              <div key={w.id} className={cn("col-span-12", colClass(w.size))}>
                <WidgetCard
                  widget={w}
                  runs={runs}
                  tools={tools}
                  dashboardStart={start}
                  dashboardEnd={end}
                  globalAgent={globalAgent}
                  agentOptions={agentOptions}
                  editMode={editMode}
                  dragMimeType={WIDGET_DND_MIME}
                  onRemove={() => removeWidget(w.id)}
                  onExpand={() => setFullscreenWidgetId(w.id)}
                  onDragOverRow={editMode ? onDragOverRow : undefined}
                  onDropOnSelf={editMode ? (e) => onDropOnWidget(e, w.id) : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <AddChartDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        agentOptions={agentOptions}
        onSave={(draft) => {
          const id = `w-${Date.now()}`
          setWidgets((prev) => [
            ...prev,
            {
              id,
              chartType: draft.chartType,
              metric: draft.metric,
              agentScope: draft.agentScope,
              viewBy: draft.viewBy,
              size: draft.size,
              comparePrevious: draft.comparePrevious,
              title: METRIC_LABELS[draft.metric],
              timeRange: draft.timeRange,
            },
          ])
          setAddOpen(false)
        }}
        dashboardStart={start}
        dashboardEnd={end}
      />

      <Dialog open={!!fullscreenWidget} onOpenChange={(open) => !open && setFullscreenWidgetId(null)}>
        <DialogContent
          showCloseButton
          className="data-[state=open]:zoom-in-100 flex h-[min(96vh,980px)] max-h-[96vh] w-[calc(100vw-0.5rem)] max-w-none flex-col gap-0 overflow-hidden rounded-[4px] border-zinc-200 p-0 font-generalSans shadow-2xl dark:border-zinc-800 sm:h-[min(94vh,960px)] sm:max-w-none"
        >
          {fullscreenWidget && (
            <>
              <div className="border-b border-zinc-200 px-6 pb-4 pt-6 pr-14 dark:border-zinc-800">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="text-xl font-bold sm:text-2xl">{fullscreenWidget.title}</DialogTitle>
                  <DialogDescription className="text-sm">
                    {fullscreenRange &&
                      (() => {
                        const fsScope =
                          globalAgent !== "all" ? globalAgent : fullscreenWidget.agentScope
                        const { start: effS, end: effE } = fullscreenRange
                        return fsScope === "all"
                          ? `All agents · ${rangeLabel(effS, effE)}`
                          : `${agentLabel(agentOptions, fsScope)} · ${rangeLabel(effS, effE)}`
                      })()}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6">
                <WidgetChartPane
                  widget={fullscreenWidget}
                  runs={runs}
                  tools={tools}
                  scope={globalAgent !== "all" ? globalAgent : fullscreenWidget.agentScope}
                  rangeStart={fullscreenRange!.start}
                  rangeEnd={fullscreenRange!.end}
                  mode="fullscreen"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WidgetCard({
  widget,
  runs,
  tools,
  dashboardStart,
  dashboardEnd,
  globalAgent,
  agentOptions,
  editMode,
  dragMimeType,
  onRemove,
  onExpand,
  onDragOverRow,
  onDropOnSelf,
}: {
  widget: DashboardWidget
  runs: AgentRunRow[]
  tools: ToolExecutionRow[]
  dashboardStart: Date
  dashboardEnd: Date
  globalAgent: string
  agentOptions: { id: string; label: string }[]
  editMode: boolean
  dragMimeType: string
  onRemove: () => void
  onExpand: () => void
  onDragOverRow?: (e: React.DragEvent) => void
  onDropOnSelf?: (e: React.DragEvent) => void
}) {
  const scope = globalAgent !== "all" ? globalAgent : widget.agentScope
  const { start: rangeStart, end: rangeEnd } = resolveWidgetTimeRange(
    widget.timeRange,
    dashboardStart,
    dashboardEnd
  )

  const subtitle =
    scope === "all"
      ? `All agents · ${rangeLabel(rangeStart, rangeEnd)}`
      : `${agentLabel(agentOptions, scope)} · ${rangeLabel(rangeStart, rangeEnd)}`

  const handleGripDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.setData(dragMimeType, widget.id)
    e.dataTransfer.setData("text/plain", widget.id)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[140px] flex-col overflow-hidden rounded-[4px] border border-zinc-200/80 bg-bg-light-lm p-5 shadow-sm dark:border-zinc-800 dark:bg-bg-light",
        widget.chartType !== "number" && "min-h-[280px]",
        widget.size === "full" && widget.chartType !== "number" && "min-h-[320px]",
        editMode && "ring-2 ring-dashed ring-slate-300/80 dark:ring-slate-600"
      )}
      onDragOver={onDragOverRow}
      onDrop={onDropOnSelf}
    >
      {editMode && (
        <div className="absolute left-2 top-2 z-20 flex items-center gap-1">
          {/* Native DnD is unreliable on <button>; use a draggable div */}
          <div
            role="button"
            tabIndex={0}
            draggable
            onDragStart={handleGripDragStart}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") ev.preventDefault()
            }}
            className="cursor-grab rounded-lg p-1.5 text-text-muted-lm hover:bg-zinc-100 hover:text-text-lm active:cursor-grabbing dark:hover:bg-zinc-800 dark:text-text-muted"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
            aria-label="Remove widget"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={cn("flex min-h-0 flex-1 flex-col", editMode && "pointer-events-none")}>
        <div
          className={cn(
            "mb-2 flex items-start justify-between gap-2 pr-1",
            editMode ? "pl-10" : "pr-0",
            "pointer-events-auto"
          )}
        >
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-lm dark:text-text">{widget.title}</h3>
            <p className="text-xs text-text-muted-lm dark:text-text-muted">{subtitle}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-text-muted-lm hover:bg-zinc-100 hover:text-primary-lm dark:hover:bg-zinc-800 dark:text-text-muted dark:hover:text-primary"
            title="Full screen"
            aria-label="Open chart in full screen"
            onClick={(e) => {
              e.stopPropagation()
              onExpand()
            }}
          >
            <Maximize2 className="h-5 w-5" />
          </Button>
        </div>
        <WidgetChartPane
          widget={widget}
          runs={runs}
          tools={tools}
          scope={scope}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          mode="embedded"
        />
      </div>
    </div>
  )
}

interface DraftChart {
  chartType: AnalyticsChartType
  metric: AnalyticsMetricId
  agentScope: string
  viewBy: AnalyticsViewBy
  size: WidgetSize
  comparePrevious: boolean
  timeRange: WidgetTimeRange
}

const WIDGET_TIME_RANGE_OPTIONS: WidgetTimeRange[] = [
  "dashboard",
  "last_7_days",
  "last_28_days",
  "last_90_days",
]

function AddChartDialog({
  open,
  onOpenChange,
  agentOptions,
  onSave,
  dashboardStart,
  dashboardEnd,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agentOptions: { id: string; label: string }[]
  onSave: (d: DraftChart) => void
  dashboardStart: Date
  dashboardEnd: Date
}) {
  const [chartType, setChartType] = useState<AnalyticsChartType>("line")
  const [metric, setMetric] = useState<AnalyticsMetricId>("agent_runs")
  const [agentScope, setAgentScope] = useState("all")
  const [viewBy, setViewBy] = useState<AnalyticsViewBy>("day")
  const [size, setSize] = useState<WidgetSize>("medium")
  const [comparePrevious, setComparePrevious] = useState(false)
  const [timeRange, setTimeRange] = useState<WidgetTimeRange>("dashboard")

  useEffect(() => {
    if (open) {
      setChartType("line")
      setMetric("agent_runs")
      setAgentScope("all")
      setViewBy("day")
      setSize("medium")
      setComparePrevious(false)
      setTimeRange("dashboard")
    }
  }, [open])

  const draftEffectiveRange = useMemo(
    () => resolveWidgetTimeRange(timeRange, dashboardStart, dashboardEnd),
    [timeRange, dashboardStart, dashboardEnd]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,940px)] w-[calc(100vw-1.25rem)] max-w-[min(96rem,calc(100vw-1.25rem))] flex-col gap-0 overflow-hidden rounded-[4px] border-zinc-200/90 p-0 font-generalSans shadow-2xl dark:border-zinc-800 sm:w-[calc(100vw-2rem)] sm:max-w-[min(96rem,calc(100vw-2rem))] sm:rounded-[4px]"
      >
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(22rem,1fr)_minmax(28rem,1.15fr)] xl:gap-2">
          <div className="space-y-8 border-b border-zinc-200 bg-bg-light-lm p-8 pb-10 dark:border-zinc-800 dark:bg-bg-light lg:border-b-0 lg:border-r lg:pb-8">
            <DialogHeader className="space-y-2 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted-lm dark:text-text-muted">
                Dashboard widget
              </p>
              <DialogTitle className="text-2xl font-bold tracking-tight text-text-lm dark:text-text">
                Add a chart or metric
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-text-muted-lm dark:text-text-muted">
                Choose how it looks, what it measures, and how it’s grouped in time. Data uses your dashboard date
                range and existing agent run and tool execution logs.
              </DialogDescription>
            </DialogHeader>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Visualization</p>
              <div className="flex flex-wrap gap-3">
                {CHART_TYPES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChartType(c.id)}
                    className={cn(
                      "flex min-w-[5.5rem] flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 transition-all",
                      chartType === c.id
                        ? "border-primary bg-primary/10 text-primary-lm shadow-sm dark:text-primary"
                        : "border-zinc-200 text-text-muted-lm hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-text-muted dark:hover:bg-zinc-800/80"
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-light-lm shadow-sm dark:bg-bg-light">
                      {c.icon}
                    </span>
                    <span className="text-center text-xs font-semibold leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Time range</p>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as WidgetTimeRange)}>
                <SelectTrigger className="h-12 rounded-xl border-zinc-200 text-sm font-medium dark:border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TIME_RANGE_OPTIONS.map((tr) => (
                    <SelectItem key={tr} value={tr}>
                      {WIDGET_TIME_RANGE_LABELS[tr]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs leading-relaxed text-text-muted-lm dark:text-text-muted">
                {timeRange === "dashboard" ? (
                  <>
                    Uses the header dates:{" "}
                    <span className="font-medium text-text-lm dark:text-text">
                      {rangeLabel(dashboardStart, dashboardEnd)}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    Rolling window ending today:{" "}
                    <span className="font-medium text-text-lm dark:text-text">
                      {rangeLabel(draftEffectiveRange.start, draftEffectiveRange.end)}
                    </span>
                    . Independent of the header “to” date.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <div>
                <Label htmlFor="compare" className="text-sm font-semibold text-text-lm dark:text-text">
                  Compare to previous period
                </Label>
                <p className="mt-0.5 text-xs text-text-muted-lm dark:text-text-muted">Overlay the prior window of the same length.</p>
              </div>
              <Switch id="compare" checked={comparePrevious} onCheckedChange={setComparePrevious} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Agent scope</p>
                <Select value={agentScope} onValueChange={setAgentScope}>
                  <SelectTrigger className="h-12 rounded-xl border-zinc-200 text-sm font-medium dark:border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Metric</p>
                <Select value={metric} onValueChange={(v) => setMetric(v as AnalyticsMetricId)}>
                  <SelectTrigger className="h-12 rounded-xl border-zinc-200 text-sm font-medium dark:border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {METRIC_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Bucket by</p>
              <div className="flex rounded-2xl border border-zinc-200 p-1.5 dark:border-zinc-800">
                {(["hour", "day", "week", "month"] as const).map((vb) => (
                  <button
                    key={vb}
                    type="button"
                    onClick={() => setViewBy(vb)}
                    className={cn(
                      "flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold capitalize",
                      viewBy === vb
                        ? "bg-text-lm text-bg-light-lm shadow-sm dark:bg-bg-light dark:text-bg-light"
                        : "text-text-muted-lm hover:bg-zinc-50 dark:text-text-muted dark:hover:bg-zinc-800"
                    )}
                  >
                    {vb}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-gradient-to-b from-zinc-100/90 to-bg-light-lm/80 p-8 dark:from-zinc-900 dark:to-bg-light/90">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Live preview</p>
            </div>

            <div className="mt-6 flex min-h-[320px] flex-1 flex-col">
              <div
                className={cn(
                  "flex flex-1 flex-col rounded-2xl border-2 border-dashed border-zinc-200/80 bg-bg-light-lm p-6 shadow-lg dark:border-zinc-600 dark:bg-bg-light",
                  (size === "large" || size === "full") && "ring-2 ring-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-lg font-bold text-text-lm dark:text-text">{METRIC_LABELS[metric]}</h4>
                    <p className="mt-1 text-sm text-text-muted-lm dark:text-text-muted">
                      {agentLabel(agentOptions, agentScope)} · {WIDGET_TIME_RANGE_LABELS[timeRange]} ·{" "}
                      {datePresetPhrase(chartType, viewBy)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-primary-lm dark:bg-primary"
                  >
                    {CHART_TYPES.find((c) => c.id === chartType)?.label ?? chartType}
                  </span>
                </div>

                <div className="mt-6 flex flex-1 items-center justify-center rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50">
                  {chartType === "number" ? (
                    <div className="text-center">
                      <p className="text-4xl font-bold tabular-nums text-text-lm dark:text-text">—</p>
                      <p className="mt-2 text-xs font-medium text-text-muted-lm dark:text-text-muted">KPI tile · value loads on the dashboard</p>
                    </div>
                  ) : (
                    <div className="flex w-full flex-col items-center gap-3 px-6 py-8 text-center">
                      <div className="flex h-24 w-full max-w-sm items-end justify-center gap-1">
                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                          <div
                            key={i}
                            className="w-full max-w-[2rem] rounded-t-md opacity-90 transition-all"
                            style={{
                              height: `${h}%`,
                              backgroundColor: i % 2 === 0 ? PRIMARY : "#94a3b8",
                            }}
                          />
                        ))}
                      </div>
                      <p className="max-w-sm text-sm text-text-muted-lm dark:text-text-muted">
                        Real chart renders on the dashboard with your date range and {viewBy} buckets.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted-lm dark:text-text-muted">Widget width</p>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-bg-light-lm p-1.5 shadow-sm dark:border-zinc-800 dark:bg-bg-light sm:grid-cols-4">
                {WIDGET_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSize(opt.id)}
                    className={cn(
                      "rounded-xl px-2 py-3 text-center text-xs font-semibold transition-colors sm:text-sm",
                      size === opt.id
                        ? "bg-text-lm text-bg-light-lm dark:bg-text dark:text-bg-light"
                        : "text-text-muted-lm hover:bg-zinc-50 dark:text-text-muted dark:hover:bg-zinc-800"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-muted-lm dark:text-text-muted">
                Full width uses the entire row (12 columns) — best for main trends.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-zinc-200 bg-bg-light-lm px-8 py-5 dark:border-zinc-800 dark:bg-bg-light">
          <Button variant="outline" className="h-11 rounded-xl px-6" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-11 rounded-xl px-8 font-semibold text-white shadow-md bg-primary-lm dark:bg-primary"
            onClick={() =>
              onSave({
                chartType,
                metric,
                agentScope,
                viewBy,
                size,
                comparePrevious,
                timeRange,
              })
            }
          >
            Add to dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function datePresetPhrase(chartType: AnalyticsChartType, viewBy: AnalyticsViewBy): string {
  if (chartType === "number") return "Current period total"
  return `By ${viewBy} · current range`
}

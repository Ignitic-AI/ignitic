"use client"

import { useState } from "react"
import { Database, TrendingUp, Users, DollarSign, Activity, Clock, ArrowRight, Loader2, CheckCircle2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useAnalyticsStore, type TokenMetricKey } from "@/app/_store/useAnalyticsStore"
import { toast } from "sonner"

interface DataItem {
  id: string
  label: string
  icon: React.ReactNode
  requiresConfig?: boolean
}

const AVAILABLE_DATA: DataItem[] = [
  { id: "agent_runs", label: "Agent Runs", icon: <Activity className="w-4 h-4" /> },
  { id: "revenue", label: "Revenue", icon: <DollarSign className="w-4 h-4" /> },
  { id: "traffic", label: "Traffic", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "users", label: "Active Users", icon: <Users className="w-4 h-4" /> },
  { id: "tokens", label: "Token Usage", icon: <Database className="w-4 h-4" />, requiresConfig: true },
]

export { AVAILABLE_DATA }

const METRIC_OPTIONS: { key: TokenMetricKey; label: string }[] = [
  { key: "input_tokens", label: "Input Tokens" },
  { key: "output_tokens", label: "Output Tokens" },
  { key: "total_tokens", label: "Total Tokens" },
]

function getDefaultTimeRange() {
  const now = new Date()
  const end = now.toISOString().slice(0, 16)
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  return { start, end }
}

export function DataSidebar() {
  const [expanded, setExpanded] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  const { tokenData, selectedMetrics, isLoading, error, fetchTokenData, toggleMetric } = useAnalyticsStore()

  const handleDragStart = (e: React.DragEvent, dataId: string) => {
    if (dataId === "tokens" && !tokenData) {
      e.preventDefault()
      toast.error("Configure token data first", {
        description: "Click on Token Usage to set a time range."
      })
      return
    }
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "data-source", id: dataId }))
    e.dataTransfer.effectAllowed = "copy"
  }

  const handleTokenClick = () => {
    if (!expanded) {
      const defaults = getDefaultTimeRange()
      if (!startTime) setStartTime(defaults.start)
      if (!endTime) setEndTime(defaults.end)
    }
    setExpanded(!expanded)
  }

  const handleFetch = async () => {
    if (!startTime || !endTime) {
      toast.error("Please specify both start and end time")
      return
    }

    if (new Date(startTime) >= new Date(endTime)) {
      toast.error("Start time must be before end time")
      return
    }

    await fetchTokenData(startTime, endTime)

    const store = useAnalyticsStore.getState()
    if (store.error) {
      toast.error("Failed to fetch data", { description: store.error })
    } else {
      toast.success("Token data loaded", {
        description: "Drag it onto a chart to visualize."
      })
    }
  }

  const isTokenReady = !!tokenData

  return (
    <aside className="w-64 border-l border-border bg-white/5 backdrop-blur-xl h-vh sticky overflow-y-auto scrollbar-hide p-4 hidden md:block font-generalSans">
      <h2 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider px-2 pt-5 font-generalSans">
        Data Sources
      </h2>
      <div className="space-y-2">
        {AVAILABLE_DATA.map((item) => {
          const isToken = item.id === "tokens"
          const canDrag = !isToken || isTokenReady

          if (isToken) {
            return (
              <div key={item.id} className="space-y-0">
                {/* Token Usage Header */}
                <div
                  draggable={canDrag}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onClick={handleTokenClick}
                  className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer
                    ${expanded
                      ? "border-primary/30 bg-primary/5 hover:bg-primary/8"
                      : isTokenReady
                        ? "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/40"
                        : "border-border/40 bg-card/40 hover:bg-card/80 hover:border-primary/20"
                    }
                    ${expanded ? "rounded-b-none" : ""}
                  `}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    isTokenReady || expanded
                      ? "bg-primary/15 text-primary"
                      : "bg-gray-400 dark:bg-background/50 text-foreground group-hover:text-primary"
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-foreground/80 group-hover:text-foreground block font-generalSans">
                      {item.label}
                    </span>
                    {isTokenReady && !expanded && (
                      <span className="text-[10px] text-muted-foreground truncate block mt-0.5 font-generalSans">
                        {tokenData.data.length} agent{tokenData.data.length !== 1 ? "s" : ""} loaded
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isTokenReady && !expanded && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {/* Expandable Config Panel */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="border border-t-0 border-primary/30 bg-primary/2 rounded-b-xl px-3 pb-3 pt-3 space-y-4">

                    {/* Time Range */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-generalSans">
                        <Clock className="w-3 h-3" />
                        Time Range
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label htmlFor="start-time" className="text-[11px] text-muted-foreground font-generalSans">
                            From
                          </Label>
                          <Input
                            id="start-time"
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="text-[10px] h-8 font-generalSans px-2 pr-3 [&::-webkit-calendar-picker-indicator]:w-3 [&::-webkit-calendar-picker-indicator]:h-3 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:mr-1"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="end-time" className="text-[11px] text-muted-foreground font-generalSans">
                            To
                          </Label>
                          <Input
                            id="end-time"
                            type="datetime-local"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="text-[10px] h-8 font-generalSans px-2 pr-3 [&::-webkit-calendar-picker-indicator]:w-3 [&::-webkit-calendar-picker-indicator]:h-3 [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:mr-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Metric Selection */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-generalSans">
                        Metrics
                      </div>
                      <div className="space-y-2">
                        {METRIC_OPTIONS.map((metric) => (
                          <label
                            key={metric.key}
                            className="flex items-center gap-2.5 cursor-pointer group/metric"
                          >
                            <Checkbox
                              checked={selectedMetrics.includes(metric.key)}
                              onCheckedChange={() => toggleMetric(metric.key)}
                              className="h-3.5 w-3.5 rounded-[3px] border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <span className="text-xs text-foreground/70 group-hover/metric:text-foreground transition-colors font-generalSans">
                              {metric.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Error State */}
                    {error && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5">
                        <p className="text-[11px] text-destructive font-medium font-generalSans">{error}</p>
                      </div>
                    )}

                    {/* Success State */}
                    {isTokenReady && !isLoading && (
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                        <p className="text-[11px] text-primary font-medium font-generalSans">
                          {tokenData.data.length} agent{tokenData.data.length !== 1 ? "s" : ""} found — drag onto a chart.
                        </p>
                      </div>
                    )}

                    {/* Fetch Button */}
                    <Button
                      onClick={handleFetch}
                      disabled={isLoading || !startTime || !endTime}
                      size="sm"
                      className="w-full text-xs h-8 gap-1.5 font-generalSans"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Fetching…
                        </>
                      ) : isTokenReady ? (
                        "Refresh Data"
                      ) : (
                        "Fetch Data"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          }

          // Non-token items
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              className="group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:shadow-md
                border-border/40 bg-card/40 hover:bg-card/80 cursor-grab active:cursor-grabbing hover:border-primary/20"
            >
              <div className="p-2 rounded-lg transition-colors bg-gray-400 dark:bg-background/50 text-foreground group-hover:text-primary">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-foreground/80 group-hover:text-foreground block font-generalSans">
                  {item.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

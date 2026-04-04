"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Upload,
  Search,
  Filter,
  Loader2,
  Trash2,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  Zap,
  Activity,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSessionStore } from "@/app/_store/useSessionStore"
import { ImportWorkflowDialog } from "@/components/ImportWorkflowDialog"
import { useCredits } from "@/context/credits-context"
import { CreditsBlockedState } from "@/components/credits/CreditsBlockedState"
import { cn } from "@/lib/utils"

const API_BASE_URL = "http://localhost:8080"
const PRIMARY = "#0056D2"

interface WorkflowInput {
  type: string
  description: string
  default: unknown
  required: boolean
}

interface WorkflowOutput {
  type: string
  description: string
}

interface WorkflowIntegration {
  id: string
  label: string
  domain: string | null
  node_type: string
}

interface WorkflowTemplate {
  id: string
  ignitic_identifier: string
  name: string
  description: string
  inputs: Record<string, WorkflowInput>
  outputs: Record<string, WorkflowOutput>
  u_id: string | null
  org_id: string | null
  created_at: string
  updated_at: string
  n8n_json: unknown
  summary_line?: string
  integrations?: WorkflowIntegration[]
  flow_steps?: string[]
  trigger_hint?: string | null
  integration_count?: number
}

interface ToolExecutionRow {
  tool_name: string
  ignitic_identifier: string
  status: "running" | "succeeded" | "failed"
  created_at: string
  _id?: string
  id?: string
}

const getCategoryFromIdentifier = (identifier: string): string => {
  const parts = identifier.split(".")
  if (parts.length >= 3) {
    return parts[2].charAt(0).toUpperCase() + parts[2].slice(1)
  }
  return "General"
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}

function formatShortTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function IntegrationChip({ integration }: { integration: WorkflowIntegration }) {
  const { label, domain } = integration
  const inner = domain ? (
    <img src={faviconUrl(domain)} alt="" className="h-4 w-4" loading="lazy" />
  ) : (
    <span className="text-[10px] font-bold uppercase text-slate-500">{label.slice(0, 2)}</span>
  )
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
            {inner}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs font-manrope text-xs">
          <p className="font-semibold">{label}</p>
          <p className="text-muted-foreground mt-0.5 break-all opacity-80">{integration.node_type}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function WorkflowsPage() {
  const session = useSessionStore((state) => state.currentSession)
  const { hasFeature, canUseFeatureAction } = useCredits()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [executions, setExecutions] = useState<ToolExecutionRow[]>([])
  const [executionsState, setExecutionsState] = useState<"idle" | "loading" | "ok" | "forbidden" | "error">("idle")

  const canViewWorkflows = hasFeature("Workflow View")
  const importAccess = canUseFeatureAction("Workflow Import")
  const canDeleteWorkflow = hasFeature("Workflow Delete")

  const toggleDescription = (id: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchTemplates = useCallback(async () => {
    const token = session?.user?.token
    if (!token) {
      setError("Authentication token is missing.")
      setIsLoadingTemplates(false)
      return
    }
    try {
      setIsLoadingTemplates(true)
      const url = `${API_BASE_URL}/api/v1/workflow-template/n8n/?limit=200&n8n_json=true`
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        let message = `Request failed (${response.status})`
        try {
          const errBody = await response.json()
          if (errBody?.message) message = errBody.message
          if (errBody?.detail) message = typeof errBody.detail === "string" ? errBody.detail : message
        } catch {
          /* ignore */
        }
        throw new Error(message)
      }
      const data: WorkflowTemplate[] = await response.json()
      setTemplates(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch templates")
    } finally {
      setIsLoadingTemplates(false)
    }
  }, [session?.user?.token])

  const fetchExecutions = useCallback(async () => {
    const token = session?.user?.token
    if (!token) return
    setExecutionsState("loading")
    try {
      const params = new URLSearchParams({
        is_workflow: "true",
        page_size: "15",
        page: "1",
      })
      const res = await fetch(`${API_BASE_URL}/api/v1/analytics/tool/executions?${params}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.status === 403) {
        setExecutions([])
        setExecutionsState("forbidden")
        return
      }
      if (!res.ok) {
        setExecutions([])
        setExecutionsState("error")
        return
      }
      const body = await res.json()
      const list = Array.isArray(body?.executions) ? body.executions : []
      setExecutions(list)
      setExecutionsState("ok")
    } catch {
      setExecutions([])
      setExecutionsState("error")
    }
  }, [session?.user?.token])

  useEffect(() => {
    if (session?.user?.token) {
      fetchTemplates()
      fetchExecutions()
    } else {
      setIsLoadingTemplates(true)
    }
  }, [session?.user?.token, fetchTemplates, fetchExecutions])

  const templateNameByIgnitic = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of templates) {
      m.set(t.ignitic_identifier, t.name)
    }
    return m
  }, [templates])

  const categories = useMemo(
    () => Array.from(new Set(templates.map((t) => getCategoryFromIdentifier(t.ignitic_identifier)))).sort(),
    [templates]
  )

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return templates.filter((template) => {
      const category = getCategoryFromIdentifier(template.ignitic_identifier)
      const matchesCategory = selectedCategory === "all" || category === selectedCategory
      if (!q) return matchesCategory
      const integText = (template.integrations ?? []).map((i) => i.label.toLowerCase()).join(" ")
      const matchesSearch =
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        (template.summary_line ?? "").toLowerCase().includes(q) ||
        integText.includes(q) ||
        template.ignitic_identifier.toLowerCase().includes(q)
      return matchesSearch && matchesCategory
    })
  }, [templates, searchQuery, selectedCategory])

  const handleDeleteClick = (id: string) => {
    setTemplateToDelete(id)
    setDeleteDialogOpen(true)
  }

  const deleteTemplate = async () => {
    if (!templateToDelete || !session?.user?.token) return
    if (!canDeleteWorkflow) {
      toast.error("Your plan does not allow deleting workflow templates.")
      return
    }
    try {
      setIsDeleting(true)
      const response = await fetch(`${API_BASE_URL}/api/v1/workflow-template/n8n/${templateToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.user.token}` },
      })
      if (!response.ok) throw new Error("Failed to delete template")
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete))
      toast.success("Template deleted successfully")
      setDeleteDialogOpen(false)
    } catch {
      toast.error("Failed to delete template")
    } finally {
      setIsDeleting(false)
      setTemplateToDelete(null)
    }
  }

  const renderDescriptionBlock = (template: WorkflowTemplate) => {
    const summary =
      (template.summary_line && template.summary_line.trim()) ||
      template.description.split("\n")[0]?.trim() ||
      ""
    const full = template.description?.trim() || ""
    const expanded = expandedDescriptions.has(template.id)
    const hasLongBody = full.length > summary.length + 12 || full.includes("\n")

    return (
      <div className="space-y-1">
        {summary && (
          <p
            className={cn(
              "text-sm font-medium leading-snug text-slate-700 dark:text-slate-200",
              !expanded && "line-clamp-2"
            )}
          >
            {summary}
          </p>
        )}
        {hasLongBody && (
          <>
            {expanded && (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{full}</p>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleDescription(template.id)
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline dark:text-blue-400"
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Minimize description
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" />
                  Expand description
                </>
              )}
            </button>
          </>
        )}
        {!summary && !hasLongBody && full && (
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{full}</p>
        )}
      </div>
    )
  }

  const renderFlowRow = (template: WorkflowTemplate) => {
    const steps = template.flow_steps ?? []
    if (steps.length === 0) return null
    const max = 6
    const shown = steps.slice(0, max)
    const rest = steps.length - max
    return (
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
        <span className="mr-1 font-semibold uppercase tracking-wide text-slate-400">Flow</span>
        {shown.map((step, idx) => (
          <span key={`${template.id}-s-${idx}`} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />}
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-800">{step}</span>
          </span>
        ))}
        {rest > 0 && <span className="text-slate-400">+{rest} more</span>}
      </div>
    )
  }

  const renderIntegrations = (template: WorkflowTemplate) => {
    const list = template.integrations ?? []
    if (list.length === 0) {
      return <span className="text-xs text-slate-400">No integrations detected</span>
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {list.slice(0, 8).map((i) => (
          <IntegrationChip key={i.id} integration={i} />
        ))}
        {(template.integration_count ?? list.length) > 8 && (
          <span className="text-xs font-medium text-slate-400">+{(template.integration_count ?? list.length) - 8}</span>
        )}
      </div>
    )
  }

  const renderTriggerBadge = (template: WorkflowTemplate) => {
    const hint = template.trigger_hint ?? "—"
    return (
      <Badge
        variant="outline"
        className="gap-1 border-slate-200 font-manrope text-xs font-semibold dark:border-slate-600"
      >
        <Zap className="h-3 w-3 text-amber-500" />
        {hint}
      </Badge>
    )
  }

  if (!canViewWorkflows) {
    return (
      <CreditsBlockedState
        title="Workflows unavailable"
        message="Your current plan does not include workflow access in this scope."
      />
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col bg-transparent py-8 font-manrope">
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0056D2] dark:text-blue-400">
              Automation
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
              Workflows
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Browse templates with a clear summary, see which apps they connect to, and review recent n8n-style runs
              from execution history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  viewMode === "table"
                    ? "bg-slate-50 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                )}
              >
                <List className="h-4 w-4" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  viewMode === "grid"
                    ? "bg-slate-50 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
            </div>
            <ImportWorkflowDialog
              onSuccess={fetchTemplates}
              disabled={!importAccess.allowed}
              disabledReason={importAccess.reason}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        className="h-11 rounded-full px-6 font-semibold text-white shadow-md"
                        style={{ backgroundColor: PRIMARY }}
                        disabled={!importAccess.allowed}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import workflow
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!importAccess.allowed && (
                    <TooltipContent>
                      <p>{importAccess.reason || "You do not have permission to import workflows."}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </ImportWorkflowDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by name, description, integrations…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 border-slate-200 pl-10 dark:border-slate-700"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-11 w-full border-slate-200 sm:w-[220px] dark:border-slate-700">
                    <Filter className="mr-2 h-4 w-4 shrink-0" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoadingTemplates && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#0056D2]" />
                </div>
              )}

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {!isLoadingTemplates && !error && viewMode === "grid" && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {filteredTemplates.map((template) => {
                    const category = getCategoryFromIdentifier(template.ignitic_identifier)
                    const inputCount = Object.keys(template.inputs || {}).length
                    const outputCount = Object.keys(template.outputs || {}).length
                    const flowEl = renderFlowRow(template)
                    return (
                      <div
                        key={template.id}
                        className="group flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-2">
                            <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                              {template.name}
                            </h3>
                            {renderDescriptionBlock(template)}
                          </div>
                          {canDeleteWorkflow && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-red-500 opacity-70 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                              onClick={() => handleDeleteClick(template.id)}
                              aria-label="Delete template"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#0056D2] font-semibold text-white hover:bg-[#0056D2]">{category}</Badge>
                          {renderTriggerBadge(template)}
                          <Badge variant="outline" className="border-slate-200 text-xs dark:border-slate-600">
                            {inputCount} in · {outputCount} out
                          </Badge>
                        </div>
                        <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-700">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Integrations
                          </p>
                          {renderIntegrations(template)}
                        </div>
                        {flowEl && <div className="mt-4">{flowEl}</div>}
                      </div>
                    )
                  })}
                  {filteredTemplates.length === 0 && (
                    <p className="col-span-full py-12 text-center text-sm text-slate-500">No templates match your filters.</p>
                  )}
                </div>
              )}

              {!isLoadingTemplates && !error && viewMode === "table" && (
                <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Template</TableHead>
                        <TableHead className="font-semibold">Category</TableHead>
                        <TableHead className="font-semibold">Trigger</TableHead>
                        <TableHead className="font-semibold">Integrations</TableHead>
                        <TableHead className="font-semibold">I/O</TableHead>
                        <TableHead className="w-[100px] font-semibold" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((template) => {
                        const category = getCategoryFromIdentifier(template.ignitic_identifier)
                        const inputCount = Object.keys(template.inputs || {}).length
                        const outputCount = Object.keys(template.outputs || {}).length
                        return (
                          <TableRow key={template.id} className="align-top">
                            <TableCell>
                              <div className="max-w-[220px] space-y-1">
                                <p className="font-semibold text-slate-900 dark:text-slate-50">{template.name}</p>
                                {(template.summary_line || template.description) && (
                                  <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                    {template.summary_line || template.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-medium">
                                {category}
                              </Badge>
                            </TableCell>
                            <TableCell>{renderTriggerBadge(template)}</TableCell>
                            <TableCell>
                              <div className="flex max-w-[200px] flex-wrap gap-1">{renderIntegrations(template)}</div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                              {inputCount} / {outputCount}
                            </TableCell>
                            <TableCell>
                              {canDeleteWorkflow && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  onClick={() => handleDeleteClick(template.id)}
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {filteredTemplates.length === 0 && (
                    <p className="py-12 text-center text-sm text-slate-500">No templates match your filters.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Workspace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Templates</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{templates.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Visible now</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{filteredTemplates.length}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Connect credentials under{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">Secrets</span> so these integrations
                  can run.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Recent workflow runs</CardTitle>
              </CardHeader>
              <CardContent>
                {executionsState === "loading" && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#0056D2]" />
                  </div>
                )}
                {executionsState === "forbidden" && (
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Execution history is not available for this account. Runs still log when your plan includes analytics.
                  </p>
                )}
                {executionsState === "error" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Could not load execution history.</p>
                )}
                {executionsState === "ok" && executions.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No workflow executions yet. They will appear here after tools mark runs with{" "}
                    <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">is_workflow=true</code>.
                  </p>
                )}
                {executionsState === "ok" && executions.length > 0 && (
                  <ul className="space-y-3">
                    {executions.map((ex) => {
                      const eid = ex._id ?? ex.id ?? `${ex.ignitic_identifier}-${ex.created_at}`
                      const matchedName = templateNameByIgnitic.get(ex.ignitic_identifier)
                      return (
                        <li
                          key={eid}
                          className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                                {matchedName ?? ex.tool_name}
                              </p>
                              {matchedName && (
                                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{ex.tool_name}</p>
                              )}
                              <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{ex.ignitic_identifier}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 text-[10px] font-semibold uppercase",
                                ex.status === "succeeded" && "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
                                ex.status === "failed" && "border-red-200 text-red-700 dark:border-red-900 dark:text-red-400",
                                ex.status === "running" && "border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-300"
                              )}
                            >
                              {ex.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">{formatShortTime(ex.created_at)}</p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="font-manrope">
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this workflow template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteTemplate} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

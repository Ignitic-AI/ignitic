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
import { API_BASE_URL } from "@/lib/api"
const PRIMARY = "var(--color-primary-lm)"
/** Max integration logos on cards (no overflow / “see all” UI). */
const INTEGRATION_LOGO_CAP = 5

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
  error?: string | null
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

function faviconUrl(domain: string, px = 32): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${px}`
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

function IntegrationChip({
  integration,
  size = "sm",
}: {
  integration: WorkflowIntegration
  size?: "sm" | "lg" | "xl"
}) {
  const { label, domain } = integration
  const isXl = size === "xl"
  const isLg = size === "lg" || isXl
  const faviconPx = isXl ? 96 : isLg ? 64 : 32
  const inner = domain ? (
    <img
      src={faviconUrl(domain, faviconPx)}
      alt=""
      className={cn(
        "transition duration-200 group-hover/logo:scale-110 group-hover/logo:brightness-105 dark:group-hover/logo:brightness-110",
        isXl ? "h-9 w-9" : isLg ? "h-7 w-7" : "h-4 w-4"
      )}
      loading="lazy"
    />
  ) : (
    <span
      className={cn(
        "font-bold uppercase text-slate-600 dark:text-slate-300",
        isXl ? "text-sm tracking-tight" : isLg ? "text-xs tracking-tight" : "text-[10px]"
      )}
    >
      {label.slice(0, 2)}
    </span>
  )
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
             className={cn(
              "group/logo inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border border-zinc-200 bg-white transition-all duration-200 outline-none hover:z-10 focus-visible:ring-2 focus-visible:ring-primary-lm/45 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-bg-light dark:focus-visible:ring-offset-zinc-950",
              isXl &&
                "h-14 w-14 rounded-2xl border-2 border-zinc-200/90 shadow-md hover:scale-110 hover:border-primary-lm/40 hover:shadow-lg active:scale-100 dark:border-zinc-800",
              !isXl &&
                isLg &&
                "h-11 w-11 rounded-xl border-2 shadow-sm hover:scale-110 hover:border-primary-lm/45 hover:shadow-lg active:scale-100",
              !isXl &&
                !isLg &&
                "h-8 w-8 rounded-lg hover:scale-105 hover:border-zinc-300 hover:shadow-md active:scale-100 dark:hover:border-zinc-700"
            )}
          >
            {inner}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs font-generalSans text-xs">
          <p className="font-semibold">{label}</p>
          <p className="text-slate-900 mt-0.5 break-all opacity-80">{integration.node_type}</p>
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [executions, setExecutions] = useState<ToolExecutionRow[]>([])
  const [executionsState, setExecutionsState] = useState<"idle" | "loading" | "ok" | "forbidden" | "error">("idle")

  const canViewWorkflows = hasFeature("Workflow View")
  const importAccess = canUseFeatureAction("Workflow Import")
  const canDeleteWorkflow = hasFeature("Workflow Delete")

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

  const renderGridDescription = (template: WorkflowTemplate) => {
    const full = (template.description ?? "").trim()
    
    return (
      <div className="relative group/desc">
        <div className="scrollbar-hide h-32 overflow-y-auto pr-1 text-sm leading-relaxed text-text-muted-lm dark:text-text-muted">
          <p className="whitespace-pre-wrap">{full || "No description provided."}</p>
          {/* Bottom blur effect */}
          <div className="pointer-events-none sticky bottom-0 h-8 w-full bg-gradient-to-t from-bg-light-lm to-transparent dark:from-bg-light/40" />
        </div>
      </div>
    )
  }

  const renderIntegrations = (template: WorkflowTemplate, variant: "grid" | "table" = "grid") => {
    const list = template.integrations ?? []
    const isGrid = variant === "grid"
    const size: "sm" | "lg" | "xl" = isGrid ? "sm" : "sm" // Made smaller for grid too as requested
    const shownList = list.slice(0, INTEGRATION_LOGO_CAP)

    if (list.length === 0) {
      return (
        <span className={cn("text-xs text-slate-400", isGrid && "text-left")}>No integrations</span>
      )
    }

    return (
      <div
        className={cn("flex flex-wrap items-center gap-1.5", isGrid ? "justify-start" : "justify-end")}
      >
        {shownList.map((i) => (
          <IntegrationChip key={i.id} integration={i} size={size} />
        ))}
      </div>
    )
  }

  const renderTriggerBadge = (template: WorkflowTemplate) => {
    const hint = template.trigger_hint ?? "—"
    return (
      <Badge
        variant="outline"
        className="gap-1 border-zinc-200 font-generalSans text-xs font-semibold dark:border-zinc-800"
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
    <div className="flex w-full min-w-0 flex-1 flex-col bg-transparent pb-8 font-generalSans">
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-4 px-6 pt-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-lm dark:text-primary">
              Automation
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-lm dark:text-text sm:text-4xl">
              Workflows
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted-lm dark:text-text-muted">
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
                        className="h-11 rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] px-6 font-generalSans font-semibold text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]"
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

        <div className="flex flex-col gap-6">
          <div className="space-y-6">
            <div className="border-y border-zinc-200/80 bg-bg-light-lm shadow-sm dark:border-zinc-800 dark:bg-bg-light/40">
              <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by name, description, integrations…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 border-slate-200 bg-transparent pl-10 dark:border-slate-700"
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
                  <Loader2 className="h-8 w-8 animate-spin text-primary-lm dark:text-primary" />
                </div>
              )}

              {error && (
                <div className="mx-6 mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {!isLoadingTemplates && !error && viewMode === "grid" && (
                <div className="grid grid-cols-1 border-t border-zinc-200 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredTemplates.map((template) => {
                    const category = getCategoryFromIdentifier(template.ignitic_identifier)
                    return (
                      <div
                        key={template.id}
                        className="group relative flex flex-col border-r border-b border-zinc-200 bg-bg-light-lm p-6 transition-all hover:bg-slate-50/50 dark:border-zinc-800 dark:bg-bg-light/10 dark:hover:bg-bg-light/20"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">{category}</Badge>
                             {renderTriggerBadge(template)}
                          </div>
                          {canDeleteWorkflow && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => handleDeleteClick(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="mb-6 space-y-3">
                          <h3 className="line-clamp-1 text-xl font-bold tracking-tight text-text-lm dark:text-text">
                            {template.name}
                          </h3>
                          {renderGridDescription(template)}
                        </div>

                        <div className="mt-auto flex items-center justify-between pt-4">
                          {renderIntegrations(template, "grid")}
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Create New Tool Placeholder */}
                  <div className="flex flex-col items-center justify-center border-b border-zinc-200 bg-slate-50/30 p-8 text-center dark:border-zinc-800 dark:bg-white/5">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200/50 dark:bg-slate-800/50">
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400">
                        <span className="text-2xl">+</span>
                      </Button>
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Create New Tool</p>
                  </div>

                  {filteredTemplates.length === 0 && (
                    <div className="col-span-full py-12 text-center text-sm text-slate-500">No templates match your filters.</div>
                  )}
                </div>
              )}

              {!isLoadingTemplates && !error && viewMode === "table" && (
                <div className="mx-6 mb-8 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Template</TableHead>
                        <TableHead className="font-semibold">Category</TableHead>
                        <TableHead className="font-semibold">Trigger</TableHead>
                        <TableHead className="font-semibold">Integrations</TableHead>
                        <TableHead className="w-[100px] font-semibold" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((template) => {
                        const category = getCategoryFromIdentifier(template.ignitic_identifier)
                        return (
                          <TableRow key={template.id} className="align-top">
                            <TableCell>
                              <div className="max-w-[220px] space-y-1">
                                <p className="font-semibold text-slate-900 dark:text-slate-50">{template.name}</p>
                                {(template.summary_line || template.description) && (
                                  <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-900">
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
                              <div className="flex max-w-[220px] flex-wrap gap-1">
                                {renderIntegrations(template, "table")}
                              </div>
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

          <div className="mx-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Workspace Card */}
            <Card className="overflow-hidden rounded-[4px] border-zinc-200 bg-bg-light-lm shadow-sm dark:border-zinc-800 dark:bg-bg-light/40">
              <CardHeader className="flex flex-row items-center justify-between pb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-lm/10 text-primary-lm dark:bg-primary/10 dark:text-primary">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-text-lm/60 dark:text-text/60">
                      Workspace
                    </CardTitle>
                    <p className="text-[10px] font-bold uppercase tracking-tight text-text-lm/40 dark:text-text/40">
                      Node Deployment
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-text-lm/40">
                  <span className="text-lg">⋮</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100/50 py-8 dark:bg-black/20">
                    <span className="text-4xl font-bold text-text-lm dark:text-text">{templates.length}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-text-lm/60 dark:text-text/60">
                      Templates
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100/50 py-8 dark:bg-black/20">
                    <span className="text-4xl font-bold text-primary-lm dark:text-primary">{filteredTemplates.length}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-text-lm/60 dark:text-text/60">
                      Visible Now
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-blue-50/50 p-4 dark:bg-blue-950/20">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                    i
                  </div>
                  <p className="text-xs leading-relaxed text-text-lm/70 dark:text-text/70">
                    Connecting your credentials will allow you to trigger automated node updates across the Alpha
                    cluster. <button className="font-bold text-blue-500 hover:underline">Link account →</button>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Workflow Runs Card */}
            
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="font-generalSans">
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

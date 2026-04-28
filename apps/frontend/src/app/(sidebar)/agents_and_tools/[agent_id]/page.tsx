"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession } from "next-auth/react"
import axios from "axios"
import { useRouter, useParams } from "next/navigation"
import { LoadingLogo } from "@/components/Loading"
import { Spinner } from "@/components/ui/spinner"
import { useOrgStore } from "@/app/_store/useorgStore"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/lib/credits"
import { AgentGlyph, ToolBrandIcon } from "../agentToolVisuals"
import {
  Settings,
  Square,
  MoreHorizontal,
  RotateCcw,
  Save,
  Activity,
  Zap,
  Target,
  Calendar,
  FileText,
  Search,
  Mail,
  Database,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Code,
  Globe,
  ImageIcon,
  FileJson,
  Sparkles,
  Users,
  BarChart3,
  LineChart,
  Shield,
  Workflow,
  Edit,
  ArrowUp,
  ArrowDown,
  Minus,
  Timer,
  Cpu,
  HardDrive,
  Gauge,
} from "lucide-react"

// Interfaces matching the API response
interface Tool {
  name: string;
  description?: string;
  category?: string;
  enabled?: boolean;
  provider?: string;
  version?: string;
  lastUsed?: string;
  usageCount?: number;
  status?: string;
  accessLevel?: string;
}

interface PerformanceData {
  successRate?: number;
  successRateChange?: number;
}

interface AgentRunAnalyticsRow {
  agent_identifier: string;
  agent_name: string;
  duration_ms: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  created_at: string;
}

interface AgentRunsAnalyticsResponse {
  agent_runs: AgentRunAnalyticsRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ToolExecutionAnalyticsRow {
  _id: string;
  tool_name: string;
  ignitic_identifier: string;
  status: "running" | "succeeded" | "failed";
  created_at: string;
}

interface ToolExecutionAnalyticsResponse {
  executions: ToolExecutionAnalyticsRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface PerformanceSummary {
  successRate: number;
  successRateChange: number;
  totalRuns: number;
  totalRunsChange: number;
  avgDurationMs: number;
  avgDurationChange: number;
  totalTokens: number;
  totalTokensChange: number;
  toolCalls: number;
  totalCost: number;
}

interface ScheduleData {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
}

interface AgentData {
  identifier: string;
  name: string;
  tools: Tool[];
  description?: string;
  system_prompt?: string;
  tags?: string[];
  status?: string;
  last_run_at?: string;
  performance?: PerformanceData;
  schedules?: ScheduleData[];
}

interface ToolExecutionLog {
  _id: string;
  tool_name: string;
  ignitic_identifier: string;
  chat_id: string | null;
  status: "running" | "succeeded" | "failed";
  is_workflow: boolean;
  workflow_provider: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ToolExecutionResponse {
  executions: ToolExecutionLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

type RecentCallsScope = "org" | "all";

/** Identifiers that cannot be deleted (mirrors backend prebuilt guard). */
const PREBUILT_AGENT_IDS = [
  "product_researcher",
  "marketer",
  "seo_agent",
  "gdrive_agent",
  "shopify_agent",
  "hubspot_agent",
  "facebook_page_agent",
  "instagram_agent",
  "super_agent",
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
}

function getPerformanceRange(range: string): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date(end)

  if (range === "24h") {
    start.setHours(start.getHours() - 24)
    return { start, end }
  }
  if (range === "30d") {
    start.setDate(start.getDate() - 30)
    return { start, end }
  }
  if (range === "90d") {
    start.setDate(start.getDate() - 90)
    return { start, end }
  }

  start.setDate(start.getDate() - 7)
  return { start, end }
}

function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime()
  const previousEnd = new Date(start.getTime())
  const previousStart = new Date(start.getTime() - durationMs)
  return { start: previousStart, end: previousEnd }
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function matchesAgentScope(igniticIdentifier: string, agentScope: string): boolean {
  const needle = `tools.${agentScope}.`
  if (igniticIdentifier.includes(needle)) return true
  const workflowNeedle = `workflows.n8n.${agentScope}.`
  return igniticIdentifier.startsWith(workflowNeedle)
}

function formatDuration(durationMs: number): string {
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(1)}s`
  return `${Math.round(durationMs)}ms`
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function buildPerformanceSummary(
  currentRuns: AgentRunAnalyticsRow[],
  previousRuns: AgentRunAnalyticsRow[],
  currentTools: ToolExecutionAnalyticsRow[],
  previousTools: ToolExecutionAnalyticsRow[]
): PerformanceSummary {
  const currentSucceeded = currentTools.filter((item) => item.status === "succeeded").length
  const currentFinished = currentTools.filter((item) => item.status !== "running").length
  const previousSucceeded = previousTools.filter((item) => item.status === "succeeded").length
  const previousFinished = previousTools.filter((item) => item.status !== "running").length

  const currentSuccessRate = currentFinished > 0 ? Number(((currentSucceeded / currentFinished) * 100).toFixed(1)) : 0
  const previousSuccessRate = previousFinished > 0 ? Number(((previousSucceeded / previousFinished) * 100).toFixed(1)) : 0

  const currentAvgDuration = currentRuns.length > 0
    ? currentRuns.reduce((sum, run) => sum + (run.duration_ms || 0), 0) / currentRuns.length
    : 0
  const previousAvgDuration = previousRuns.length > 0
    ? previousRuns.reduce((sum, run) => sum + (run.duration_ms || 0), 0) / previousRuns.length
    : 0

  const currentTokens = currentRuns.reduce((sum, run) => sum + (run.total_tokens || 0), 0)
  const previousTokens = previousRuns.reduce((sum, run) => sum + (run.total_tokens || 0), 0)
  const totalCost = currentRuns.reduce((sum, run) => sum + (run.cost || 0), 0)

  return {
    successRate: currentSuccessRate,
    successRateChange: percentChange(currentSuccessRate, previousSuccessRate),
    totalRuns: currentRuns.length,
    totalRunsChange: percentChange(currentRuns.length, previousRuns.length),
    avgDurationMs: currentAvgDuration,
    avgDurationChange: percentChange(currentAvgDuration, previousAvgDuration),
    totalTokens: currentTokens,
    totalTokensChange: percentChange(currentTokens, previousTokens),
    toolCalls: currentTools.length,
    totalCost,
  }
}

async function fetchAllAgentRuns(
  token: string,
  agentIdentifier: string,
  start: Date,
  end: Date,
  orgOnly: boolean
): Promise<AgentRunAnalyticsRow[]> {
  const rows: AgentRunAnalyticsRow[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await axios.get<AgentRunsAnalyticsResponse>(`${API_BASE_URL}/api/v1/analytics/agent/runs`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        agent_identifier: agentIdentifier,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        org_only: orgOnly,
        page,
        page_size: 100,
      },
    })
    rows.push(...(response.data.agent_runs || []))
    totalPages = response.data.total_pages || 1
    page += 1
  } while (page <= totalPages && page <= 80)

  return rows
}

async function fetchAllToolExecutions(
  token: string,
  start: Date,
  end: Date,
  orgOnly: boolean
): Promise<ToolExecutionAnalyticsRow[]> {
  const rows: ToolExecutionAnalyticsRow[] = []
  let page = 1
  let totalPages = 1

  do {
    const response = await axios.get<ToolExecutionAnalyticsResponse>(`${API_BASE_URL}/api/v1/analytics/tool/executions`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        org_only: orgOnly,
        page,
        page_size: 100,
      },
    })
    rows.push(...(response.data.executions || []))
    totalPages = response.data.total_pages || 1
    page += 1
  } while (page <= totalPages && page <= 80)

  return rows
}

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params.agent_id as string
  const { data: session } = useSession()
  const router = useRouter()
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const organizationId = currentOrg?.id ?? null

  const [agent, setAgent] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editable state
  const [systemPrompt, setSystemPrompt] = useState("")
  const [agentName, setAgentName] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // UI state
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [performanceTimeRange, setPerformanceTimeRange] = useState<string>("7d")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [recentCalls, setRecentCalls] = useState<ToolExecutionLog[]>([])
  const [recentCallsTotal, setRecentCallsTotal] = useState(0)
  const [recentCallsLoading, setRecentCallsLoading] = useState(false)
  const [recentCallsError, setRecentCallsError] = useState<string | null>(null)
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null)
  const [performanceLoading, setPerformanceLoading] = useState(false)
  const [performanceError, setPerformanceError] = useState<string | null>(null)
  const [recentCallsScope, setRecentCallsScope] = useState<RecentCallsScope>(
    organizationId ? "org" : "all"
  )

  useEffect(() => {
    const fetchAgent = async () => {
      if (!session?.user?.token || !agentId) return
      try {
        setLoading(true)
        const response = await axios.get(`${API_BASE_URL}/api/v1/agents/${agentId}/get-agent`, {
          headers: {
            Authorization: `Bearer ${session.user.token}`,
          },
        })
        const data = response.data
        setAgent(data)
        
        // Initialize editable state
        setAgentName(data.name || "")
        setSystemPrompt(data.system_prompt || "")
        setTags(data.tags || [])
      } catch (err: any) {
        console.error("Failed to fetch agent:", err)
        const d = err.response?.data?.detail
        const msg =
          typeof d === "string"
            ? d
            : err.response?.data?.error || err.response?.data?.message || "Failed to load agent details"
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchAgent()
  }, [agentId, session?.user?.token])

  useEffect(() => {
    if (organizationId) {
      setRecentCallsScope("org")
    } else {
      setRecentCallsScope("all")
    }
  }, [organizationId])

  useEffect(() => {
    const fetchRecentCalls = async () => {
      if (!session?.user?.token || !agentId) return
      const effectiveScope: RecentCallsScope =
        recentCallsScope === "org" && !organizationId ? "all" : recentCallsScope
      try {
        setRecentCallsLoading(true)
        const response = await axios.get<ToolExecutionResponse>(
          `${API_BASE_URL}/api/v1/agents/${agentId}/tool-calls`,
          {
            headers: {
              Authorization: `Bearer ${session.user.token}`,
            },
            params: {
              scope: effectiveScope,
              organization_id: effectiveScope === "org" ? organizationId || undefined : undefined,
              page: 1,
              page_size: 50,
            },
          }
        )
        setRecentCalls(response.data.executions || [])
        setRecentCallsTotal(response.data.total || 0)
        setRecentCallsError(null)
      } catch (err: any) {
        console.error("Failed to fetch recent calls:", err)
        setRecentCallsError(err.response?.data?.detail || "Failed to load recent calls")
      } finally {
        setRecentCallsLoading(false)
      }
    }

    fetchRecentCalls()
  }, [agentId, session?.user?.token, recentCallsScope, organizationId])

  useEffect(() => {
    const fetchPerformance = async () => {
      if (!session?.user?.token || !agentId) return

      const orgOnly = Boolean(organizationId)
      const { start, end } = getPerformanceRange(performanceTimeRange)
      const previousRange = getPreviousRange(start, end)

      try {
        setPerformanceLoading(true)
        setPerformanceError(null)

        const [
          currentRuns,
          previousRuns,
          currentToolsRaw,
          previousToolsRaw,
        ] = await Promise.all([
          fetchAllAgentRuns(session.user.token, agentId, start, end, orgOnly),
          fetchAllAgentRuns(session.user.token, agentId, previousRange.start, previousRange.end, orgOnly),
          fetchAllToolExecutions(session.user.token, start, end, orgOnly),
          fetchAllToolExecutions(session.user.token, previousRange.start, previousRange.end, orgOnly),
        ])

        const currentTools = currentToolsRaw.filter((item) => matchesAgentScope(item.ignitic_identifier, agentId))
        const previousTools = previousToolsRaw.filter((item) => matchesAgentScope(item.ignitic_identifier, agentId))

        setPerformanceSummary(buildPerformanceSummary(currentRuns, previousRuns, currentTools, previousTools))
      } catch (err: any) {
        console.error("Failed to fetch performance analytics:", err)
        setPerformanceSummary(null)
        setPerformanceError(err.response?.data?.detail || "Failed to load performance analytics")
      } finally {
        setPerformanceLoading(false)
      }
    }

    void fetchPerformance()
  }, [agentId, organizationId, performanceTimeRange, session?.user?.token])

  const handlePromptChange = (value: string) => {
    setSystemPrompt(value)
    setHasChanges(true)
  }

  const handleNameChange = (value: string) => {
    setAgentName(value)
    setHasChanges(true)
  }


  const handleReset = () => {
    if (agent) {
      setSystemPrompt(agent.system_prompt || "")
      setAgentName(agent.name || "")
      setTags(agent.tags || [])
      setHasChanges(false)
    }
  }

  const handleSave = async () => {
    if (!session?.user?.token || !agentId) return
    try {
      console.log("Saving changes...")
      await axios.put(`${API_BASE_URL}/api/v1/agents/${agentId}/update-agent`, {
        name: agentName,
        system_prompt: systemPrompt,
        tags: tags
      }, {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          "Content-Type": "application/json"
        }
      })
      
      // Update local state to reflect saved changes
      setAgent(prev => prev ? ({
        ...prev,
        name: agentName,
        system_prompt: systemPrompt,
        tags: tags
      }) : null)
      
      setHasChanges(false)
      // Optional: Add toast notification here
    } catch (err: any) {
      console.error("Failed to update agent:", err)
      // Optional: Add error toast here
    }
  }

  const handleStop = () => {
    console.log("Stopping agent...")
  }

  const isPrebuilt =
    !agent?.identifier || PREBUILT_AGENT_IDS.includes(agent.identifier)

  const handleDeleteAgent = async () => {
    if (!session?.user?.token || !agentId || isPrebuilt) return
    if (!confirm(`Delete custom agent "${agent?.name || agentId}"? This cannot be undone.`)) return
    setDeleteError(null)
    setDeleting(true)
    try {
      const { status, data } = await axios.delete(`${API_BASE_URL}/api/v1/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${session.user.token}` },
        validateStatus: () => true,
      })
      if (status >= 400) {
        const body = data as { detail?: string; error?: string }
        setDeleteError(
          (typeof body.detail === "string" && body.detail) ||
            body.error ||
            "Could not delete agent. You may need organization admin rights."
        )
        return
      }
      router.push("/agents_and_tools")
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string; detail?: string } } }
      setDeleteError(
        ax.response?.data?.detail?.toString() ||
          ax.response?.data?.error ||
          "Delete failed"
      )
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen min-w-screen ">
        <LoadingLogo />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-lm dark:bg-bg">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-lm dark:text-text mb-2">Error Loading Agent</h2>
          <p className="text-gray-500">{error || "Agent not found"}</p>
          <Button className="mt-4" onClick={() => router.push("/agents_and_tools")}>
            Back to Agents
          </Button>
        </div>
      </div>
    )
  }

  // Keep tools API-driven while adding only a stable local id for list rendering.
  const enhancedTools = (agent.tools ?? []).map((tool, index) => ({
    ...tool,
    id: index.toString(),
  }))

  // Filter tools
  const filteredTools = enhancedTools.filter((tool) => {
    const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tool.description ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categories = ["all", ...Array.from(new Set(enhancedTools.map((tool) => tool.category).filter(Boolean)))] as string[]
  const enabledTools = enhancedTools.filter((tool) => typeof tool.enabled === "boolean")
  const enabledToolsCount = enabledTools.filter((tool) => tool.enabled).length
  const hasEnabledState = enabledTools.length > 0
  const schedules = agent.schedules ?? []
  const hasPerformanceData = performanceSummary !== null

  const getTrendIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-3 w-3" />
    if (change < 0) return <ArrowDown className="h-3 w-3" />
    return <Minus className="h-3 w-3" />
  }

  const getTrendColor = (change: number, inverse = false) => {
    if (inverse) {
      if (change > 0) return "text-danger-lm dark:text-danger"
      if (change < 0) return "text-success-lm dark:text-success"
    } else {
      if (change > 0) return "text-success-lm dark:text-success"
      if (change < 0) return "text-danger-lm dark:text-danger"
    }
    return "text-text-muted-lm dark:text-text-muted"
  }

  const formatToolName = (toolName: string) =>
    toolName
      .split("_")
      .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ")

  return (
    <div className="min-h-screen bg-bg-lm text-text-lm dark:bg-bg dark:text-text font-generalSans">
      <motion.div
        className="container mx-auto px-4 py-8 max-w-7xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {deleteError && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {deleteError}
          </div>
        )}
        {/* Header Section */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <AgentGlyph agentName={agent.identifier} size="xl" />
              </motion.div>

              {/* Agent Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-text-lm dark:text-text">{agent.name}</h1>
                  {agent.status && (
                    <Badge variant="outline" className="bg-bg-dark-lm dark:bg-bg text-text-muted-lm dark:text-text-muted border-border-lm dark:border-border">
                      {agent.status}
                    </Badge>
                  )}
                </div>

                <p className="text-gray-400 mb-4 max-w-3xl">{agent.description || "No description provided."}</p>

                <div className="flex items-center gap-3 flex-wrap">
                  {tags.map((tag, index) => (
                    <motion.div
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Badge variant="secondary" className="bg-primary-lm dark:bg-primary text-white font-semibold rounded-xl">
                        {tag}
                      </Badge>
                    </motion.div>
                  ))}
                  {agent.last_run_at && (
                    <span className="text-sm text-text-muted-lm dark:text-text-muted">Last run: {agent.last_run_at}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <motion.div
              className="flex items-center gap-3 flex-wrap"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button variant="outline" className="bg-bg-lm dark:bg-bg border-border-lm dark:border-border hover:bg-info-lm dark:hover:bg-info hover:text-white">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
              {!isPrebuilt && (
                <Button
                  variant="destructive"
                  className="border border-red-700 text-white"
                  disabled={deleting}
                  onClick={handleDeleteAgent}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? "Deleting…" : "Delete agent"}
                </Button>
              )}
              <Button
                variant="destructive"
                className="bg-danger-lm dark:bg-danger hover:bg-red-900 border border-red-700 text-white"
                onClick={handleStop}
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Tabs Navigation */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="tools" >
            <TabsList className="bg-bg-light-lm dark:bg-bg-light border-b border-border-lm dark:border-border justify-start h-auto p-0 rounded-lg">
              {/* <TabsTrigger
                value="configuration"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white px-6 py-3 rounded-l-lg text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </TabsTrigger> */}
              <TabsTrigger
                value="tools"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white px-6 py-3 rounded-l-lg text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Zap className="h-4 w-4 mr-2" />
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white rounded-none px-6 py-3 text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <FileText className="h-4 w-4 mr-2" />
                Recent Calls
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white rounded-none px-6 py-3 text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Activity className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger
                value="scheduling"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white rounded-r-lg px-6 py-3 text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Scheduling
              </TabsTrigger>
            </TabsList>

            {/* Configuration tab temporarily hidden */}

            {/* Tools Tab */}
            <TabsContent value="tools" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Tools Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-text-lm dark:text-text mb-2">Available Tools</h2>
                    {hasEnabledState ? (
                      <p className="text-text-muted-lm dark:text-text-muted">
                        Manage and configure tools for your agent. {enabledToolsCount} of {enhancedTools.length} tools enabled.
                      </p>
                    ) : (
                      <p className="text-text-muted-lm dark:text-text-muted">
                        Manage and configure tools for your agent. {enhancedTools.length} tools available.
                      </p>
                    )}
                  </div>
                  <Button className="bg-primary-lm dark:bg-primary hover:opacity-90 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tool
                  </Button>
                </div>

                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted-lm dark:text-text-muted" />
                    <Input
                      placeholder="Search tools..."
                      value={searchQuery}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border text-text-lm dark:text-text placeholder:text-text-muted-lm dark:placeholder:text-text-muted"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-48 bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border text-text-lm dark:text-text">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category === "all" ? "All Categories" : category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tools Grid */}
                <div className="grid gap-4">
                  {filteredTools.length > 0 ? (
                    filteredTools.map((tool, index) => (
                      <motion.div
                        key={tool.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border hover:border-highlight-lm dark:hover:border-highlight transition-colors">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                <div
                                  className={`flex shrink-0 items-center justify-center rounded-xl ${
                                    tool.enabled ? "" : "opacity-60 grayscale"
                                  }`}
                                >
                                  <ToolBrandIcon
                                    toolName={tool.name}
                                    sourceAgentName={agent.identifier}
                                    size={56}
                                  />
                                </div>

                                {/* Tool Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold text-text-lm dark:text-text">{tool.name}</h3>
                                    {tool.category && (
                                      <Badge variant="outline" className="bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted text-xs border-zinc-200 dark:border-zinc-800 rounded-xl">
                                        {tool.category}
                                      </Badge>
                                    )}
                                  </div>
                                  {tool.description && <p className="text-sm text-text-muted-lm dark:text-text-muted mb-3">{tool.description}</p>}

                                  {/* Tool Meta */}
                                  {(tool.provider || tool.version || tool.lastUsed || typeof tool.usageCount === "number") && (
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted-lm dark:text-text-muted">
                                      {tool.provider && (
                                        <span className="flex items-center gap-1">
                                          <Sparkles className="h-3 w-3" />
                                          {tool.provider}
                                        </span>
                                      )}
                                      {tool.version && (
                                        <span className="flex items-center gap-1">
                                          <Code className="h-3 w-3" />
                                          {tool.version}
                                        </span>
                                      )}
                                      {tool.lastUsed && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          Last used {tool.lastUsed}
                                        </span>
                                      )}
                                      {typeof tool.usageCount === "number" && (
                                        <span className="flex items-center gap-1">
                                          <Activity className="h-3 w-3" />
                                          {tool.usageCount.toLocaleString()} uses
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Tool Actions */}
                              <div className="flex items-center gap-3 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-bg-dark-lm dark:bg-bg-dark border-border-lm dark:border-border hover:bg-bg-lm dark:hover:bg-bg text-text-lm dark:text-text"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                {typeof tool.enabled === "boolean" && <Switch checked={tool.enabled} />}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-text-muted-lm dark:text-text-muted hover:text-danger-lm dark:hover:text-danger hover:bg-danger-lm/10 dark:hover:bg-danger/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  ) : (
                    <Card className="bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                      <CardContent className="p-12 text-center">
                        <Zap className="h-12 w-12 text-text-muted-lm dark:text-text-muted mx-auto mb-4" />
                        <p className="text-text-muted-lm dark:text-text-muted">No tools found matching your criteria</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </motion.div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Performance Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold font-generalSans text-text-lm dark:text-text mb-2">Performance Metrics</h2>
                    <p className="font-generalSans text-text-muted-lm dark:text-text-muted">Monitor agent performance and resource utilization</p>
                  </div>
                  <Select value={performanceTimeRange} onValueChange={setPerformanceTimeRange}>
                    <SelectTrigger className="w-48 bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border text-text-lm dark:text-text font-generalSans">
                      <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Key Metrics Grid */}
                {performanceLoading ? (
                  <Card className="rounded-[4px] bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                    <CardContent className="p-12 flex items-center justify-center">
                      <Spinner className="h-6 w-6 text-text-muted-lm dark:text-text-muted" />
                    </CardContent>
                  </Card>
                ) : performanceError ? (
                  <Card className="rounded-[4px] bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                    <CardContent className="p-12 text-center">
                      <AlertCircle className="h-12 w-12 text-danger-lm dark:text-danger mx-auto mb-4" />
                      <p className="font-generalSans text-text-muted-lm dark:text-text-muted">{performanceError}</p>
                    </CardContent>
                  </Card>
                ) : hasPerformanceData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                        <Card className="rounded-[4px] bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium font-generalSans text-text-muted-lm dark:text-text-muted flex items-center justify-between">
                              Success Rate
                              <CheckCircle className="h-4 w-4 text-success-lm dark:text-success" />
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                          <div className="text-3xl font-bold font-generalSans text-success-lm dark:text-success">{performanceSummary.successRate}%</div>
                          {typeof performanceSummary.successRateChange === "number" && (
                            <p
                              className={`text-xs mt-1 font-generalSans flex items-center gap-1 ${getTrendColor(performanceSummary.successRateChange)}`}
                            >
                              {getTrendIcon(performanceSummary.successRateChange)}
                              {Math.abs(performanceSummary.successRateChange)}% from last period
                            </p>
                          )}
                          <p className="text-xs mt-3 font-generalSans text-text-muted-lm dark:text-text-muted">
                            {performanceSummary.toolCalls.toLocaleString()} tool calls in this range
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <Card className="rounded-[4px] bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium font-generalSans text-text-muted-lm dark:text-text-muted flex items-center justify-between">
                            Total Runs
                            <BarChart3 className="h-4 w-4 text-info-lm dark:text-info" />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold font-generalSans text-text-lm dark:text-text">{performanceSummary.totalRuns.toLocaleString()}</div>
                          <p className={`text-xs mt-1 font-generalSans flex items-center gap-1 ${getTrendColor(performanceSummary.totalRunsChange)}`}>
                            {getTrendIcon(performanceSummary.totalRunsChange)}
                            {Math.abs(performanceSummary.totalRunsChange)}% from last period
                          </p>
                          <p className="text-xs mt-3 font-generalSans text-text-muted-lm dark:text-text-muted">
                            ${performanceSummary.totalCost.toFixed(2)} estimated cost
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Card className="rounded-[4px] bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium font-generalSans text-text-muted-lm dark:text-text-muted flex items-center justify-between">
                            Avg Duration
                            <Timer className="h-4 w-4 text-warning-lm dark:text-warning" />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold font-generalSans text-text-lm dark:text-text">
                            {formatDuration(performanceSummary.avgDurationMs)}
                          </div>
                          <p className={`text-xs mt-1 font-generalSans flex items-center gap-1 ${getTrendColor(performanceSummary.avgDurationChange, true)}`}>
                            {getTrendIcon(performanceSummary.avgDurationChange)}
                            {Math.abs(performanceSummary.avgDurationChange)}% from last period
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <Card className="rounded-[4px] bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium font-generalSans text-text-muted-lm dark:text-text-muted flex items-center justify-between">
                            Token Usage
                            <Cpu className="h-4 w-4 text-primary-lm dark:text-primary" />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold font-generalSans text-text-lm dark:text-text">
                            {formatCompactNumber(performanceSummary.totalTokens)}
                          </div>
                          <p className={`text-xs mt-1 font-generalSans flex items-center gap-1 ${getTrendColor(performanceSummary.totalTokensChange)}`}>
                            {getTrendIcon(performanceSummary.totalTokensChange)}
                            {Math.abs(performanceSummary.totalTokensChange)}% from last period
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                ) : (
                  <Card className="rounded-[4px] bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                    <CardContent className="p-12 text-center">
                      <Activity className="h-12 w-12 text-text-muted-lm dark:text-text-muted mx-auto mb-4" />
                      <p className="font-generalSans text-text-muted-lm dark:text-text-muted">No performance metrics available for this agent.</p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* Scheduling Tab */}
            <TabsContent value="scheduling" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Scheduling Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-text-lm dark:text-text mb-2">Scheduled Tasks</h2>
                    <p className="text-text-muted-lm dark:text-text-muted">
                      Manage automated execution schedules.
                    </p>
                  </div>
                  <Button className="bg-primary-lm dark:bg-primary hover:opacity-90 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                </div>
                {/* Schedules List */}
                <div className="space-y-4">
                  {schedules.length > 0 ? (
                    schedules.map((schedule, index) => (
                      <motion.div
                        key={schedule.id || `${schedule.name || "schedule"}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="bg-bg-light-lm dark:bg-bg-light border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors border-l-4 border-l-success-lm">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-success-lm/10 border border-success-lm/20">
                                  <Calendar className="h-7 w-7 text-success-lm dark:text-success" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    {schedule.name && <h3 className="text-lg font-semibold text-text-lm dark:text-text">{schedule.name}</h3>}
                                    {schedule.status && (
                                      <Badge variant="outline" className="bg-success-lm/10 text-success-lm border-success-lm/50 rounded-xl">
                                        {schedule.status}
                                      </Badge>
                                    )}
                                  </div>
                                  {schedule.description && <p className="text-sm text-text-muted-lm dark:text-text-muted mb-4">{schedule.description}</p>}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  ) : (
                    <Card className="bg-bg-light-lm dark:bg-bg-light border-zinc-200 dark:border-zinc-800">
                      <CardContent className="p-12 text-center">
                        <Calendar className="h-12 w-12 text-text-muted-lm dark:text-text-muted mx-auto mb-4" />
                        <p className="text-text-muted-lm dark:text-text-muted">No schedules available for this agent.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </motion.div>
            </TabsContent>

            {/* Recent Calls Tab */}
            <TabsContent value="logs" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <Card className="bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border rounded-[4px]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-generalSans font-semibold text-text-lm dark:text-text">
                      Recent Calls
                    </CardTitle>
                    <CardDescription className="text-text-muted-lm dark:text-text-muted font-generalSans">
                      Latest tool executions for this agent ({recentCallsTotal} total).
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="mb-4 flex rounded-full p-1 backdrop-blur-md bg-white/20 dark:bg-white/10 shadow-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "h-7 px-3 text-xs flex-1 rounded-full transition-colors",
                          recentCallsScope === "org"
                            ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                            : "bg-transparent text-text-muted-lm dark:text-text-muted"
                        )}
                        disabled={!organizationId}
                        onClick={() => setRecentCallsScope("org")}
                      >
                        Current Org
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "h-7 px-3 text-xs flex-1 rounded-full transition-colors",
                          recentCallsScope === "all"
                            ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                            : "bg-transparent text-text-muted-lm dark:text-text-muted"
                        )}
                        onClick={() => setRecentCallsScope("all")}
                      >
                        All Executions
                      </Button>
                    </div>

                    {recentCallsLoading ? (
                      <div className="py-3 flex justify-center">
                        <Spinner className="w-5 h-5 text-text-muted-lm dark:text-text-muted" />
                      </div>
                    ) : recentCallsError ? (
                      <div className="rounded-[4px] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                        {recentCallsError}
                      </div>
                    ) : recentCalls.length === 0 ? (
                      <div className="p-10 text-center rounded-[4px] border border-border-lm dark:border-border">
                        <FileText className="h-10 w-10 text-text-muted-lm dark:text-text-muted mx-auto mb-3" />
                        <p className="text-text-muted-lm dark:text-text-muted font-generalSans">No recent calls found.</p>
                      </div>
                    ) : (
                      <div className="recent-calls-scroll max-h-[280px] overflow-y-auto pr-1 space-y-3">
                        {recentCalls.map((call) => (
                          <div
                            key={call._id}
                            className="rounded-[4px] border border-border-lm dark:border-border bg-bg-lm dark:bg-bg px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <h4 className="font-generalSans font-semibold text-sm text-text-lm dark:text-text truncate">
                                {formatToolName(call.tool_name)}
                              </h4>
                              <Badge
                                className={
                                  call.status === "succeeded"
                                    ? "bg-success-lm/15 dark:bg-success/15 text-success-lm dark:text-success border border-success-lm/30 dark:border-success/30 rounded-full"
                                    : call.status === "failed"
                                      ? "bg-danger-lm/15 dark:bg-danger/15 text-danger-lm dark:text-danger border border-danger-lm/30 dark:border-danger/30 rounded-full"
                                      : "bg-info-lm/15 dark:bg-info/15 text-info-lm dark:text-info border border-info-lm/30 dark:border-info/30 rounded-full"
                                }
                              >
                                {call.status}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-text-muted-lm dark:text-text-muted font-generalSans">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{new Date(call.created_at).toLocaleString()}</span>
                              {call.workflow_provider && (
                                <>
                                  <span>•</span>
                                  <span>{call.workflow_provider}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
      <style jsx global>{`
        .recent-calls-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
        }

        .recent-calls-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
          background: transparent;
        }

        .recent-calls-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .recent-calls-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 9999px;
        }
      `}</style>
    </div>
  )
}

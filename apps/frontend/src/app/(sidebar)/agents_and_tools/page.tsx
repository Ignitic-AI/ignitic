"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { useSession } from "next-auth/react"
import { LoadingLogo } from "@/components/Loading"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  PlusCircle,
  LayoutGrid,
  Network,
  Wrench,
  Bot,
  Settings,
  MoreVertical,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { AgentsGraphView } from "@/components/agents/AgentsGraphView"
import { cn } from "@/lib/utils"
import { AgentGlyph, PRIMARY, ToolBrandIcon } from "./agentToolVisuals"

interface Tool {
  name: string
  description: string
}

interface Agent {
  identifier: string
  name: string
  type?: string
  parent?: string
  tools: Tool[]
}

/** Prebuilt / template agents — matches backend `PrebuiltAgents` identifiers. */
const VERIFIED_AGENT_IDS = new Set([
  "product_researcher",
  "marketer",
  "seo_agent",
  "gdrive_agent",
  "shopify_agent",
  "hubspot_agent",
  "facebook_page_agent",
  "instagram_agent",
  "email_marketing_agent",
  "customer_support_agent",
  "analytics_agent",
])

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

const formatAgentName = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

const formatToolTitle = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

type AgentFilterTab = "all" | "verified" | "custom"
type ToolsScopeTab = "all" | "connected"

const TOOLS_PREVIEW = 6
/** Exactly this many agent cards per slide, single row. */
const AGENTS_PER_SLIDE = 3

export default function AgentToolSelector() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signup")
    }
  }, [status, router])

  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Single focused agent (by `name`, matching API selection). */
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"cards" | "graph">("cards")
  const [search, setSearch] = useState("")
  const [agentFilter, setAgentFilter] = useState<AgentFilterTab>("all")
  const [toolsScope, setToolsScope] = useState<ToolsScopeTab>("all")
  const [toolsTableExpanded, setToolsTableExpanded] = useState(false)
  /** Page index for agent carousel (each page shows `AGENTS_PER_SLIDE` cards, one row). */
  const [agentSlideIndex, setAgentSlideIndex] = useState(0)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/agents/`, {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
            "Content-Type": "application/json",
          },
        })
        setAgents(response.data)
        if (response.data.length > 0) {
          setSelectedAgentName((prev) => {
            if (prev && response.data.some((a: Agent) => a.name === prev)) return prev
            return response.data[0].name as string
          })
        }
      } catch (err: unknown) {
        console.error("Failed to fetch agents:", err)
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : null
        setError(msg || "Failed to load agents")
      } finally {
        setLoading(false)
      }
    }
    if (session?.user?.token) {
      fetchAgents()
    }
  }, [session?.user?.token])

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const searchQ = norm(search.trim())

  const agentsByFilter = useMemo(() => {
    if (agentFilter === "all") return agents
    if (agentFilter === "verified") {
      return agents.filter((a) => VERIFIED_AGENT_IDS.has(a.identifier))
    }
    return agents.filter((a) => !VERIFIED_AGENT_IDS.has(a.identifier))
  }, [agents, agentFilter])

  const filteredAgents = useMemo(() => {
    if (!searchQ) return agentsByFilter
    return agentsByFilter.filter(
      (a) =>
        norm(a.name).includes(searchQ) ||
        norm(formatAgentName(a.name)).includes(searchQ) ||
        a.tools.some((t) => norm(t.name).includes(searchQ) || norm(t.description).includes(searchQ))
    )
  }, [agentsByFilter, searchQ])

  const selectedAgent = useMemo(
    () => agents.find((a) => a.name === selectedAgentName) ?? null,
    [agents, selectedAgentName]
  )

  const toolsForTable = useMemo(() => {
    if (!selectedAgent) return []
    const list = selectedAgent.tools
    if (toolsScope === "connected") {
      const withDesc = list.filter((t) => (t.description ?? "").trim().length > 0)
      return withDesc.length > 0 ? withDesc : list
    }
    return list
  }, [selectedAgent, toolsScope])

  const visibleTools = toolsTableExpanded ? toolsForTable : toolsForTable.slice(0, TOOLS_PREVIEW)
  const hiddenToolCount = Math.max(0, toolsForTable.length - TOOLS_PREVIEW)

  useEffect(() => {
    if (!selectedAgentName || filteredAgents.length === 0) return
    if (!filteredAgents.some((a) => a.name === selectedAgentName)) {
      setSelectedAgentName(filteredAgents[0].name)
      setToolsTableExpanded(false)
    }
  }, [filteredAgents, selectedAgentName])

  const agentSlideCount = Math.max(1, Math.ceil(filteredAgents.length / AGENTS_PER_SLIDE))
  const maxAgentSlide = agentSlideCount - 1

  useEffect(() => {
    setAgentSlideIndex((i) => Math.min(i, maxAgentSlide))
  }, [maxAgentSlide])

  useEffect(() => {
    setAgentSlideIndex(0)
  }, [agentFilter, search])

  const visibleAgentSlots = useMemo(() => {
    const start = agentSlideIndex * AGENTS_PER_SLIDE
    const slice = filteredAgents.slice(start, start + AGENTS_PER_SLIDE)
    return [0, 1, 2].map((i) => slice[i] ?? null)
  }, [filteredAgents, agentSlideIndex])

  if (loading || status === "unauthenticated") {
    return <LoadingLogo />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6 font-generalSans">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const totalTools = agents.reduce((acc, a) => acc + a.tools.length, 0)

  const graphHeader = (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Label className="text-lg font-semibold text-text-lm dark:text-text">Agent &amp; tool graph</Label>
        <span className="text-sm text-text-muted-lm dark:text-text-muted">
          {agents.length} agents · {totalTools} tools
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-10 shrink-0 rounded-xl font-semibold text-white shadow-sm bg-primary-lm dark:bg-primary"
          onClick={() => router.push("/agents_and_tools/create")}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Create new agent
        </Button>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              "text-text-muted-lm hover:bg-white dark:text-text-muted dark:hover:bg-slate-800"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("graph")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            )}
          >
            <Network className="h-4 w-4" />
            Graph
          </button>
        </div>
      </div>
    </div>
  )

  if (viewMode === "graph") {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col font-generalSans">
        {graphHeader}
        <div className="min-h-0 w-full flex-1">
          <AgentsGraphView agents={agents} fullPage />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex w-full min-w-0 flex-1 flex-col bg-transparent py-8 font-generalSans">
      <div className="w-full min-w-0 space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-lm dark:text-text sm:text-4xl">
              Agents &amp; tools
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted-lm dark:text-text-muted">
              Browse specialists that power your workspace. Select an agent to review its tools and permissions, or
              open the graph to see how everything connects.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-10 rounded-xl px-5 font-semibold text-white shadow-sm bg-primary-lm dark:bg-primary"
              onClick={() => router.push("/agents_and_tools/create")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new agent
            </Button>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("graph")}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-text-muted-lm transition-colors hover:bg-slate-50 dark:text-text-muted dark:hover:bg-slate-800"
              >
                <Network className="h-4 w-4" />
                Graph
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search agents, capabilities, or connected tools…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#0056D2] focus:outline-none focus:ring-2 focus:ring-[#0056D2]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
            {(
              [
                ["all", "All"],
                ["verified", "Verified"],
                ["custom", "Custom"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAgentFilter(key)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  agentFilter === key
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent cards — one row, exactly 3 per slide; arrows move by one slide */}
        {filteredAgents.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-text-muted-lm dark:text-text-muted">
                {filteredAgents.length} agent{filteredAgents.length === 1 ? "" : "s"}
                {agentSlideCount > 1 && (
                  <span className="text-text-muted-lm/60 dark:text-text-muted/60">
                    {" "}
                    · slide {agentSlideIndex + 1} of {agentSlideCount}
                  </span>
                )}
              </p>
              {agentSlideCount > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border-slate-200 dark:border-slate-700"
                    disabled={agentSlideIndex <= 0}
                    onClick={() => setAgentSlideIndex((i) => Math.max(0, i - 1))}
                    aria-label="Previous agents"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border-slate-200 dark:border-slate-700"
                    disabled={agentSlideIndex >= maxAgentSlide}
                    onClick={() => setAgentSlideIndex((i) => Math.min(maxAgentSlide, i + 1))}
                    aria-label="Next agents"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch] md:overflow-visible md:pb-0">
              <div className="mx-auto grid min-w-[720px] grid-cols-3 gap-4 md:min-w-0 md:gap-5">
              {visibleAgentSlots.map((agent, slotIdx) => {
                if (!agent) {
                  return (
                    <div
                      key={`empty-${agentSlideIndex}-${slotIdx}`}
                      className="pointer-events-none min-h-[1px] rounded-2xl border border-transparent"
                      aria-hidden
                    />
                  )
                }
                const formatted = formatAgentName(agent.name)
                const isSelected = agent.name === selectedAgentName
                const previewTools = agent.tools.slice(0, 5)
                const n = agent.tools.length
                const cardCopy =
                  n > 0
                    ? `${formatted} connects ${n} tool${n === 1 ? "" : "s"} to your automations.`
                    : "No tools linked yet—open configure to add capabilities."

                return (
                  <button
                    key={agent.identifier}
                    type="button"
                    onClick={() => {
                      setSelectedAgentName(agent.name)
                      setToolsTableExpanded(false)
                    }}
                    className={cn(
                      "flex min-w-0 w-full flex-col rounded-[4px] border bg-bg-light-lm p-4 text-left shadow-sm transition-all dark:bg-bg-light sm:p-5",
                      "hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:hover:border-zinc-600",
                      isSelected
                        ? "border-[#0056D2] shadow-md ring-2 ring-[#0056D2]/15 dark:ring-[#0056D2]/25"
                        : "border-zinc-200/80 dark:border-zinc-800"
                    )}
                  >
                    <div className="flex gap-3 sm:gap-4">
                      <AgentGlyph agentName={agent.identifier} size="lg" className="shrink-0 self-start" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-snug text-text-lm dark:text-text sm:text-base">
                              {formatted}
                            </p>
                            <p className="mt-1 text-xs text-text-muted-lm dark:text-text-muted">Active</p>
                          </div>
                          {isSelected && (
                            <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-muted-lm dark:text-text-muted sm:mt-4 sm:text-sm">
                      {cardCopy}
                    </p>
                    <div className="mt-4 flex min-h-[36px] items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:mt-5 sm:min-h-[40px] sm:pt-4">
                      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
                        {previewTools.length > 0 ? (
                          <ul className="flex list-none items-center pl-0" aria-label="Tool logos">
                            {previewTools.map((t, i) => (
                              <li
                                key={t.name}
                                className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm dark:border-slate-900 dark:bg-slate-800 sm:h-9 sm:w-9"
                                style={{ zIndex: previewTools.length - i, marginLeft: i === 0 ? 0 : -8 }}
                              >
                                <ToolBrandIcon
                                  toolName={t.name}
                                  sourceAgentName={agent.identifier}
                                  size={26}
                                  className="!rounded-full border-0 shadow-none ring-0 !ring-transparent"
                                />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 sm:h-9 sm:w-9">
                            <Wrench className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 tabular-nums text-[11px] font-medium text-text-muted-lm dark:text-text-muted sm:text-xs">
                        {n} {n === 1 ? "tool" : "tools"}
                      </span>
                    </div>
                  </button>
                )
              })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Tools table — selected agent */}
        <div
          className={cn(
            "rounded-[4px] border border-zinc-200/80 bg-bg-light-lm p-6 shadow-lg shadow-slate-200/40 dark:border-zinc-800 dark:bg-bg-light dark:shadow-none sm:p-8"
          )}
        >
          {selectedAgent ? (
            <>
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0056D2] dark:text-blue-400">
                    Capabilities &amp; API permissions
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-text-lm dark:text-text sm:text-2xl">
                    {formatAgentName(selectedAgent.name)} tools
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-text-muted-lm dark:text-text-muted">
                    Tools exposed to this agent. Configure the agent to edit prompts, credentials, and availability.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setToolsScope("all")}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        toolsScope === "all"
                          ? "bg-white text-text-lm shadow-sm dark:bg-slate-900 dark:text-text"
                          : "text-text-muted-lm dark:text-text-muted"
                      )}
                    >
                      All tools
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolsScope("connected")}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        toolsScope === "connected"
                          ? "bg-white text-text-lm shadow-sm dark:bg-slate-900 dark:text-text"
                          : "text-text-muted-lm dark:text-text-muted"
                      )}
                    >
                      Connected
                    </button>
                  </div>
                  <Button
                    type="button"
                    className="h-10 rounded-xl font-semibold text-white shadow-sm bg-primary-lm dark:bg-primary"
                    onClick={() => router.push(`/agents_and_tools/${selectedAgent.identifier}`)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Configure agent
                  </Button>
                </div>
              </div>

              {toolsForTable.length > 0 ? (
                <div className="mt-6 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Tool name
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Description
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Status
                          </th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Access level
                          </th>
                          <th className="w-14 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {visibleTools.map((tool) => (
                          <tr
                            key={tool.name}
                            className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ToolBrandIcon
                                  toolName={tool.name}
                                  sourceAgentName={selectedAgent.identifier}
                                  size={28}
                                  className="shrink-0"
                                />
                                <span className="font-semibold text-text-lm dark:text-text">
                                  {formatToolTitle(tool.name)}
                                </span>
                              </div>
                            </td>
                            <td className="max-w-xs px-4 py-3 text-text-muted-lm dark:text-text-muted">
                              <span className="line-clamp-2">{tool.description || "—"}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-text-muted-lm dark:bg-slate-800 dark:text-text-muted">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                                Connected
                              </span>
                            </td>
                            <td className="px-4 py-3 text-text-muted-lm dark:text-text-muted">Full API</td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuItem
                                    className="cursor-pointer rounded-lg"
                                    onClick={() => router.push(`/agents_and_tools/${selectedAgent.identifier}`)}
                                  >
                                    Open agent settings
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!toolsTableExpanded && hiddenToolCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setToolsTableExpanded(true)}
                      className="w-full border-t border-slate-100 bg-slate-50/50 py-3 text-center text-sm font-semibold text-[#0056D2] transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/80 dark:text-blue-400 dark:hover:bg-slate-800"
                    >
                      View {hiddenToolCount} more tool{hiddenToolCount === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-8 rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-700">
                  <Wrench className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    No tools for this agent in the current view
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="py-14 text-center">
              <Bot className="mx-auto mb-3 h-11 w-11 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Select an agent above</p>
              <p className="mt-1 text-xs text-slate-500">Its tools and permissions will show here.</p>
            </div>
          )}
        </div>
      </div>

      {/* FAB — create agent */}
      <button
        type="button"
        aria-label="Create new agent"
        onClick={() => router.push("/agents_and_tools/create")}
        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-[#0056D2]/30 transition-transform hover:scale-105 active:scale-95 bg-primary-lm dark:bg-primary"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>
    </div>
  )
}

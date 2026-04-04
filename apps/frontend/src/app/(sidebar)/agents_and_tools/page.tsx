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
  Search,
  PlusCircle,
  LayoutGrid,
  Network,
  ChevronRight,
  Wrench,
  Bot,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface ToolEntry extends Tool {
  sourceAgents: string[]
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

const formatAgentName = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

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
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"cards" | "graph">("cards")
  const [search, setSearch] = useState("")

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
          setSelectedAgents([response.data[0].name])
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

  const currentlySelectedAgents = useMemo(
    () => agents.filter((a) => selectedAgents.includes(a.name)),
    [agents, selectedAgents]
  )

  const combinedToolEntries: ToolEntry[] = useMemo(() => {
    const map = new Map<string, ToolEntry>()
    for (const agent of currentlySelectedAgents) {
      for (const tool of agent.tools) {
        const existing = map.get(tool.name)
        if (existing) {
          if (!existing.sourceAgents.includes(agent.identifier)) {
            existing.sourceAgents.push(agent.identifier)
          }
        } else {
          map.set(tool.name, {
            name: tool.name,
            description: tool.description,
            sourceAgents: [agent.identifier],
          })
        }
      }
    }
    return Array.from(map.values())
  }, [currentlySelectedAgents])

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const searchQ = norm(search.trim())

  const filteredAgents = useMemo(() => {
    if (!searchQ) return agents
    return agents.filter(
      (a) =>
        norm(a.name).includes(searchQ) ||
        norm(formatAgentName(a.name)).includes(searchQ) ||
        a.tools.some((t) => norm(t.name).includes(searchQ) || norm(t.description).includes(searchQ))
    )
  }, [agents, searchQ])

  const filteredToolEntries = useMemo(() => {
    if (!searchQ) return combinedToolEntries
    return combinedToolEntries.filter(
      (t) =>
        norm(t.name).includes(searchQ) ||
        norm(t.description).includes(searchQ) ||
        t.sourceAgents.some((a) => norm(a).includes(searchQ))
    )
  }, [combinedToolEntries, searchQ])

  function handleFilterChange(value: string) {
    if (value === "select-all") {
      setSelectedAgents(agents.map((agent) => agent.name))
    } else if (value === "deselect-all") {
      setSelectedAgents([])
    } else {
      setSelectedAgents([value])
    }
  }

  if (loading || status === "unauthenticated") {
    return <LoadingLogo />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6 font-manrope">
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
        <Label className="text-lg font-semibold text-slate-900 dark:text-slate-50">Agent &amp; tool graph</Label>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {agents.length} agents · {totalTools} tools
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-11 shrink-0 rounded-full font-semibold text-white shadow-md"
          style={{ backgroundColor: PRIMARY }}
          onClick={() => router.push("/agents_and_tools/create")}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Create custom agent
        </Button>
        <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              "text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("graph")}
            className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
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
      <div className="flex min-h-0 w-full flex-1 flex-col font-manrope">
        {graphHeader}
        <div className="min-h-0 flex-1 w-full">
          <AgentsGraphView agents={agents} fullPage />
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col bg-transparent py-8 font-manrope">
      <div className="w-full min-w-0 space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: PRIMARY }}>
              Automations
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
              Agents &amp; tools
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Browse specialists that power your workspace—each with branded capabilities. Select an agent to inspect
              its tools, or open the graph to see how everything connects.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-11 rounded-full px-5 font-semibold text-white shadow-md"
              style={{ backgroundColor: PRIMARY }}
              onClick={() => router.push("/agents_and_tools/create")}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create custom agent
            </Button>
            <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("graph")}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Network className="h-4 w-4" />
                Graph
              </button>
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search agents or tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#0056D2] focus:outline-none focus:ring-2 focus:ring-[#0056D2]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Agents</h2>
              {selectedAgents.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {selectedAgents.length} selected
                </span>
              )}
            </div>
            <Select onValueChange={handleFilterChange}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 sm:w-[220px] dark:border-slate-700">
                <SelectValue placeholder="Focus agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select-all">Select all</SelectItem>
                <SelectItem value="deselect-all">Deselect all</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.name} value={agent.name}>
                    {formatAgentName(agent.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => {
              const formatted = formatAgentName(agent.name)
              return (
                <button
                  key={agent.identifier}
                  type="button"
                  onClick={() => router.push(`/agents_and_tools/${agent.identifier}`)}
                  className={cn(
                    "group flex w-full items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition-all",
                    "hover:border-[#0056D2]/35 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500/40"
                  )}
                >
                  <AgentGlyph agentName={agent.identifier} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{formatted}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {agent.tools.length} tool{agent.tools.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#0056D2]" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-200 pt-8 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Tools</h2>
            {selectedAgents.length === 0 ? (
              <span className="text-sm text-slate-500">Select agents to merge tool lists</span>
            ) : (
              <span className="text-sm text-slate-500">
                From{" "}
                <span className="font-medium" style={{ color: PRIMARY }}>
                  {selectedAgents.length === 1
                    ? formatAgentName(selectedAgents[0])
                    : `${selectedAgents.length} agents`}
                </span>
                {filteredToolEntries.length > 0 && (
                  <span className="text-slate-400"> · {filteredToolEntries.length} unique</span>
                )}
              </span>
            )}
          </div>

          {selectedAgents.length > 0 && filteredToolEntries.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredToolEntries.map((tool) => {
                const primaryAgent = tool.sourceAgents[0]
                const title = tool.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
                return (
                  <div
                    key={tool.name}
                    className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                      <ToolBrandIcon
                        key={`${tool.name}-${primaryAgent}`}
                        toolName={tool.name}
                        sourceAgentName={primaryAgent}
                        size={44}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-50">{title}</p>
                        {tool.sourceAgents.length > 1 && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            +{tool.sourceAgents.length - 1} more agent
                            {tool.sourceAgents.length > 2 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {tool.description}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : selectedAgents.length > 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <Wrench className="mx-auto mb-3 h-11 w-11 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No tools for this selection</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <Bot className="mx-auto mb-3 h-11 w-11 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Select one or more agents</p>
              <p className="mt-1 text-xs text-slate-500">Tool cards will show vendor logos when we can match them</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import axios from "axios"
import { LoadingLogo } from "@/components/Loading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2, Wrench } from "lucide-react"

const API = "http://localhost:8080/api/v1"

interface ToolOption {
  name: string
  description?: string | null
}

export default function CreateCustomAgentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [toolsCatalog, setToolsCatalog] = useState<ToolOption[]>([])
  const [loadingTools, setLoadingTools] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [identifier, setIdentifier] = useState("")
  const [description, setDescription] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [agentType, setAgentType] = useState<"worker" | "orchestrator">("worker")
  const [parent, setParent] = useState("super_agent")
  const [isOrg, setIsOrg] = useState(false)
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
  const [toolFilter, setToolFilter] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signup")
    }
  }, [status, router])

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.token) return
      setLoadingTools(true)
      setError(null)
      try {
        const { data } = await axios.get<ToolOption[]>(`${API}/agents/available-tools`, {
          headers: { Authorization: `Bearer ${session.user.token}` },
        })
        setToolsCatalog(Array.isArray(data) ? data : [])
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { error?: string; detail?: string } } }
        const msg =
          ax.response?.data?.detail ||
          ax.response?.data?.error ||
          "Could not load tools. Check that the AI engine and MCP `/custom` server are running."
        setError(typeof msg === "string" ? msg : "Failed to load available tools")
      } finally {
        setLoadingTools(false)
      }
    }
    load()
  }, [session?.user?.token])

  const filteredTools = useMemo(() => {
    const q = toolFilter.trim().toLowerCase()
    if (!q) return toolsCatalog
    return toolsCatalog.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    )
  }, [toolsCatalog, toolFilter])

  const toggleTool = (name: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedTools((prev) => {
      const next = new Set(prev)
      filteredTools.forEach((t) => next.add(t.name))
      return next
    })
  }

  const clearSelection = () => setSelectedTools(new Set())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.token) return
    setSubmitting(true)
    setError(null)
    try {
      const idTrim = identifier.trim()
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        type: agentType,
        parent: parent.trim() || "super_agent",
        tags: [],
        tool_names: Array.from(selectedTools),
        is_org: isOrg,
      }
      if (idTrim) payload.identifier = idTrim

      const { data, status: httpStatus } = await axios.post(`${API}/agents/`, payload, {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      })

      if (httpStatus >= 400) {
        const body = data as { detail?: string | unknown; error?: string }
        const d = body.detail
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d)
              ? (d as { msg?: string }[]).map((x) => x.msg).join("; ")
              : body.error || `Request failed (${httpStatus})`
        setError(msg)
        return
      }

      const created = data as { identifier?: string }
      if (created.identifier) {
        router.push(`/agents_and_tools/${created.identifier}`)
      } else {
        router.push("/agents_and_tools")
      }
    } catch (e: unknown) {
      const ax = e as { message?: string }
      setError(ax.message || "Failed to create agent")
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return <LoadingLogo />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 font-generalSans">
      <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-8">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/agents_and_tools")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create custom agent</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Define a name, instructions, and optionally restrict which MCP tools from the custom server this agent may
            use. Submitting requires organization admin (same as updating agents).
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
              <CardDescription>Identifier is optional; if omitted, one is derived from the name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Support triage"
                  required
                  minLength={1}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="identifier">Identifier (optional)</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="lowercase_letters_numbers_underscores"
                  pattern="[a-z0-9_]*"
                  title="Only a–z, 0–9, underscore"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={1}
                  maxLength={500}
                  rows={3}
                  placeholder="Short summary of what this agent does"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="system_prompt">System prompt</Label>
                <Textarea
                  id="system_prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  required
                  minLength={1}
                  maxLength={8000}
                  rows={8}
                  placeholder="Instructions and behavior for the model"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={agentType} onValueChange={(v) => setAgentType(v as "worker" | "orchestrator")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="orchestrator">Orchestrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent">Parent agent id</Label>
                  <Input
                    id="parent"
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                    placeholder="super_agent"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="is_org">Organization-scoped agent</Label>
                  <p className="text-sm text-muted-foreground">Create for the current organization instead of your user.</p>
                </div>
                <Switch id="is_org" checked={isOrg} onCheckedChange={setIsOrg} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Tools
              </CardTitle>
              <CardDescription>
                Leave none selected to allow all custom MCP tools (same as empty allowlist). Select specific tools to
                restrict the agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingTools ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tool catalog…
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Filter tools by name or description…"
                    value={toolFilter}
                    onChange={(e) => setToolFilter(e.target.value)}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="secondary" size="sm" onClick={selectAllFiltered}>
                      Select all filtered
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
                      Clear selection
                    </Button>
                    <span className="text-sm text-muted-foreground self-center">
                      {selectedTools.size} selected
                    </span>
                  </div>
                  <ScrollArea className="h-[320px] rounded-md border p-3">
                    <div className="space-y-3 pr-3">
                      {filteredTools.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tools match the filter.</p>
                      ) : (
                        filteredTools.map((t) => (
                          <label
                            key={t.name}
                            className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedTools.has(t.name)}
                              onCheckedChange={() => toggleTool(t.name)}
                            />
                            <span className="min-w-0">
                              <span className="font-medium block">{t.name}</span>
                              {t.description && (
                                <span className="text-xs text-muted-foreground line-clamp-2">{t.description}</span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => router.push("/agents_and_tools")}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingTools}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create agent"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

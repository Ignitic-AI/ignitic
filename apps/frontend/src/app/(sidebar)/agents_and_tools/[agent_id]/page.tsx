"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession } from "next-auth/react"
import axios from "axios"
import { useRouter, useParams } from "next/navigation"
import { LoadingLogo } from "@/components/Loading"
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
  Bot,
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
  description: string;
  // Add optional fields to match the UI usage if needed, or map them
  category?: string;
  icon?: any;
  enabled?: boolean;
  provider?: string;
  version?: string;
  lastUsed?: string;
  usageCount?: number;
}

interface AgentData {
  identifier: string;
  name: string;
  tools: Tool[];
  description?: string;
  system_prompt?: string;
  tags?: string[];
}

// Mock data for fields not yet in API
const mockPerformance = {
  successRate: 94.2,
  successRateChange: 2.3,
  avgResponseTime: "2.3s",
  avgResponseTimeChange: -0.4,
  totalExecutions: 1247,
  totalExecutionsChange: 156,
  errorRate: 2.1,
  errorRateChange: -0.5,
  uptime: 99.8,
  uptimeChange: 0.1,
  throughput: 342,
  throughputChange: 23,
  latencyP95: "3.8s",
  latencyP95Change: -0.2,
  memoryUsage: 68,
  memoryUsageChange: 5,
}

const mockPerformanceHistory = [
  { date: "Mon", executions: 156, errors: 4, avgTime: 2.1 },
  { date: "Tue", executions: 189, errors: 3, avgTime: 2.3 },
  { date: "Wed", executions: 178, errors: 5, avgTime: 2.4 },
  { date: "Thu", executions: 203, errors: 2, avgTime: 2.2 },
  { date: "Fri", executions: 198, errors: 6, avgTime: 2.5 },
  { date: "Sat", executions: 167, errors: 3, avgTime: 2.3 },
  { date: "Sun", executions: 156, errors: 4, avgTime: 2.3 },
]

const mockTopErrors = [
  { error: "Connection Timeout", count: 12, percentage: 35 },
  { error: "Invalid API Key", count: 8, percentage: 24 },
  { error: "Rate Limit Exceeded", count: 7, percentage: 21 },
  { error: "Data Parsing Error", count: 4, percentage: 12 },
  { error: "Unknown Error", count: 3, percentage: 8 },
]

const mockSchedules = [
  {
    id: "1",
    name: "Daily Lead Scan",
    description: "Scan and qualify new leads from all connected sources",
    cron: "0 9 * * *",
    enabled: true,
    nextRun: "Tomorrow at 9:00 AM",
    lastRun: "Today at 9:00 AM",
    status: "active" as const,
    frequency: "Daily",
    timezone: "UTC-5 (EST)",
    executions: 156,
    successRate: 98.5,
  },
]

const mockCapabilities = [
    {
      id: "1",
      name: "Lead Qualification",
      description: "Identify and qualify high-value prospects from multiple channels",
      score: 95,
      category: "Core",
      icon: Target,
      enabled: true,
      accuracy: "98.5%",
      avgTime: "1.2s",
      totalUses: 5234,
      lastImproved: "2 days ago",
    },
]

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

export default function AgentDetailPage() {
  const params = useParams()
  const agentId = params.agent_id as string
  const { data: session } = useSession()
  const router = useRouter()

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
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all")
  const [capabilitySearch, setCapabilitySearch] = useState("")
  const [performanceTimeRange, setPerformanceTimeRange] = useState<string>("7d")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAgent = async () => {
      if (!session?.user?.token || !agentId) return
      try {
        setLoading(true)
        const response = await axios.get(`http://localhost:8080/api/v1/agents/${agentId}/get-agent`, {
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
      await axios.put(`http://localhost:8080/api/v1/agents/${agentId}/update-agent`, {
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
      const { status, data } = await axios.delete(`http://localhost:8080/api/v1/agents/${agentId}`, {
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

  // Enhance tools with mock UI data for display
  const enhancedTools = agent.tools.map((tool, index) => ({
    ...tool,
    id: index.toString(),
    category: tool.category || "General",
    icon: tool.icon || Code,
    enabled: tool.enabled ?? true,
    provider: tool.provider || "System",
    version: tool.version || "1.0",
    lastUsed: tool.lastUsed || "Never",
    usageCount: tool.usageCount || 0,
  }))

  // Filter tools
  const filteredTools = enhancedTools.filter((tool) => {
    const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categories = ["all", ...Array.from(new Set(enhancedTools.map((tool) => tool.category)))]

  // Mock capabilities for UI
  const filteredCapabilities = mockCapabilities.filter((capability) => {
    const matchesCategory = capabilityFilter === "all" || capability.category === capabilityFilter
    const matchesSearch =
      capabilitySearch === "" ||
      capability.name.toLowerCase().includes(capabilitySearch.toLowerCase()) ||
      capability.description.toLowerCase().includes(capabilitySearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const capabilityCategories = ["all", ...Array.from(new Set(mockCapabilities.map((cap) => cap.category)))]

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
              {/* Agent Avatar */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <Avatar className="h-20 w-20 border-2 border-border-lm dark:border-border ">
                  <AvatarImage src="/placeholder.svg" alt={agent.name} />
                  <AvatarFallback className="bg-bg-light-lm dark:bg-bg-light text-info-lm dark:text-info">
                    <Bot className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
              </motion.div>

              {/* Agent Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-text-lm dark:text-text">{agent.name}</h1>
                  <Badge variant="outline" className="bg-bg-dark-lm dark:bg-bg text-success-lm dark:success border-green-500/50">
                    <span className="relative flex h-2 w-2 mr-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Active
                  </Badge>
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
                      <Badge variant="secondary" className="bg-blue-300 dark:bg-info text-bg-lm  dark:text-bg">
                        {tag}
                      </Badge>
                    </motion.div>
                  ))}
                  <span className="text-sm text-text-muted-lm dark:text-text-muted">Last run: 15 minutes ago</span>
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
          <Tabs defaultValue="configuration" >
            <TabsList className="bg-bg-light-lm dark:bg-bg-light border-b border-border-lm dark:border-border justify-start h-auto p-0 rounded-lg">
              <TabsTrigger
                value="configuration"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white px-6 py-3 rounded-l-lg text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white rounded-none px-6 py-3 text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Zap className="h-4 w-4 mr-2" />
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="capabilities"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white rounded-none px-6 py-3 text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Target className="h-4 w-4 mr-2" />
                Capabilities
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
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white rounded-none px-6 py-3 text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Scheduling
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="data-[state=active]:bg-info-lm dark:data-[state=active]:bg-info data-[state=active]:text-white rounded-r-lg px-6 py-3 text-text-muted-lm dark:text-text hover:text-text-lm dark:hover:text-text dark:data-[state=active]:text-white"
              >
                <FileText className="h-4 w-4 mr-2" />
                Activity Logs
              </TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="configuration" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="bg-bg-light-lm dark:bg-bg-light rounded-lg border border-border-lm dark:border-border p-6">
                  {/* Header with Actions */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-text-lm dark:text-text">Agent Configuration</h2>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        className="bg-bg-dark-lm dark:bg-bg-dark border-border-lm dark:border-border hover:bg-bg-lm dark:hover:bg-bg text-text-lm dark:text-text"
                        onClick={handleReset}
                        disabled={!hasChanges}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      <Button className="bg-primary-lm dark:bg-primary hover:opacity-90 text-white" onClick={handleSave} disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </div>

                  {/* System Prompt Section */}
                  <div className="mb-8">
                    <Label className="text-lg font-semibold text-text-lm dark:text-text mb-4 block">System Prompt & Instructions</Label>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => handlePromptChange(e.target.value)}
                      className="min-h-[300px] bg-bg-lm dark:bg-bg border-border-lm dark:border-border text-text-lm dark:text-text font-mono text-sm resize-none placeholder:text-text-muted-lm dark:placeholder:text-text-muted"
                      placeholder="Enter system prompt and instructions..."
                    />
                    <p className="text-sm text-text-muted-lm dark:text-text-muted mt-2">{systemPrompt.length} characters</p>
                  </div>

                  {/* Additional Settings */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-lm dark:text-text mb-4">Additional Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="agentName" className="text-text-muted-lm dark:text-text-muted mb-2 block">
                          Agent Name
                        </Label>
                        <Input
                          id="agentName"
                          value={agentName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          className="bg-bg-lm dark:bg-bg border-border-lm dark:border-border text-text-lm dark:text-text"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Tools Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-text-lm dark:text-text mb-2">Available Tools</h2>
                    <p className="text-text-muted-lm dark:text-text-muted">
                      Manage and configure tools for your agent. {enhancedTools.filter((t) => t.enabled).length} of{" "}
                      {enhancedTools.length} tools enabled.
                    </p>
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
                      onChange={(e) => setSearchQuery(e.target.value)}
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
                                {/* Tool Icon */}
                                <div
                                  className={`h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    tool.enabled
                                      ? "bg-info-lm/10 dark:bg-info/10 border border-info-lm/20 dark:border-info/20"
                                      : "bg-bg-dark-lm dark:bg-bg-dark border border-border-lm dark:border-border"
                                  }`}
                                >
                                  <Code
                                    className={`h-7 w-7 ${tool.enabled ? "text-info-lm dark:text-info" : "text-text-muted-lm dark:text-text-muted"}`}
                                  />
                                </div>

                                {/* Tool Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold text-text-lm dark:text-text">{tool.name}</h3>
                                    <Badge variant="outline" className="bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted text-xs border-border-lm dark:border-border">
                                      {tool.category}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-text-muted-lm dark:text-text-muted mb-3">{tool.description}</p>

                                  {/* Tool Meta */}
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted-lm dark:text-text-muted">
                                    <span className="flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      {tool.provider}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Code className="h-3 w-3" />
                                      {tool.version}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Last used {tool.lastUsed}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Activity className="h-3 w-3" />
                                      {tool.usageCount.toLocaleString()} uses
                                    </span>
                                  </div>
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
                                <Switch checked={tool.enabled} />
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

            {/* Capabilities Tab */}
            <TabsContent value="capabilities" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                 {/* Capabilities Header */}
                 <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-text-lm dark:text-text mb-2">Agent Capabilities</h2>
                    <p className="text-text-muted-lm dark:text-text-muted">
                      View and manage capabilities. {filteredCapabilities.filter((c) => c.enabled).length} of{" "}
                      {filteredCapabilities.length} capabilities enabled.
                    </p>
                  </div>
                  <Button className="bg-primary-lm dark:bg-primary hover:opacity-90 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Capability
                  </Button>
                </div>
                {/* Capabilities Grid */}
                <div className="grid gap-4">
                  {filteredCapabilities.map((capability, index) => (
                      <motion.div
                        key={capability.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border hover:border-highlight-lm dark:hover:border-highlight transition-colors">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-lm/10 dark:bg-primary/10 border border-primary-lm/20 dark:border-primary/20">
                                  <Target className="h-7 w-7 text-primary-lm dark:text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold text-text-lm dark:text-text">{capability.name}</h3>
                                    <Badge variant="outline" className="bg-bg-dark-lm dark:bg-bg-dark text-text-muted-lm dark:text-text-muted text-xs border-border-lm dark:border-border">
                                      {capability.category}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-text-muted-lm dark:text-text-muted mb-3">{capability.description}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Performance Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-text-lm dark:text-text mb-2">Performance Metrics</h2>
                    <p className="text-text-muted-lm dark:text-text-muted">Monitor agent performance and resource utilization</p>
                  </div>
                  <Select value={performanceTimeRange} onValueChange={setPerformanceTimeRange}>
                    <SelectTrigger className="w-48 bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border text-text-lm dark:text-text">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Card className="bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-text-muted-lm dark:text-text-muted flex items-center justify-between">
                          Success Rate
                          <CheckCircle className="h-4 w-4 text-success-lm dark:text-success" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-success-lm dark:text-success">{mockPerformance.successRate}%</div>
                        <p
                          className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(mockPerformance.successRateChange)}`}
                        >
                          {getTrendIcon(mockPerformance.successRateChange)}
                          {Math.abs(mockPerformance.successRateChange)}% from last period
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                  {/* ... other metrics ... */}
                </div>
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
                  {mockSchedules.map((schedule, index) => (
                    <motion.div
                      key={schedule.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-950 border border-green-800">
                                <Calendar className="h-7 w-7 text-green-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-semibold text-white">{schedule.name}</h3>
                                  <Badge variant="outline" className="bg-green-950/50 text-green-400 border-green-500/50">Active</Badge>
                                </div>
                                <p className="text-sm text-gray-400 mb-4">{schedule.description}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="mt-8">
                <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No activity logs found</p>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  )
}

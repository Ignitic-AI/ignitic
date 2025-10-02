"use client"

import { useState } from "react"
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
import { useParams } from "next/navigation"

// Mock agent data
const mockAgent = {
  id: "1",
  name: "LeadFlow Pro",
  description:
    "Advanced lead generation agent specializing in ecommerce customer acquisition, lead scoring, and conversion optimization workflows",
  status: "active" as const,
  avatar: "",
  tags: ["Lead Generation", "Ecommerce", "Sales"],
  lastRun: "15 minutes ago",
  systemPrompt: `You are LeadFlow Pro, an advanced AI agent specialized in ecommerce lead generation and customer acquisition. Your primary responsibilities include:

1. Identifying and qualifying high-value prospects from multiple channels
2. Analyzing customer behavior and purchase intent signals
3. Creating personalized outreach campaigns and follow-up sequences
4. Scoring leads based on engagement and conversion probability
5. Optimizing conversion funnels and reducing cart abandonment
6. Generating detailed lead reports and ROI analytics`,
  agentName: "LeadFlow Pro",
  agentDescription: "Advanced lead generation agent for ecommerce",
  tools: [
    {
      id: "1",
      name: "Web Search",
      description: "Search the web for real-time information and data",
      category: "Search",
      icon: Search,
      enabled: true,
      provider: "Google",
      version: "v3.2",
      lastUsed: "2 hours ago",
      usageCount: 1247,
    },
    {
      id: "2",
      name: "Email Automation",
      description: "Send personalized emails and manage campaigns",
      category: "Communication",
      icon: Mail,
      enabled: true,
      provider: "SendGrid",
      version: "v4.0",
      lastUsed: "15 minutes ago",
      usageCount: 856,
    },
    {
      id: "3",
      name: "CRM Integration",
      description: "Connect and sync with CRM systems",
      category: "Integration",
      icon: Database,
      enabled: false,
      provider: "Salesforce",
      version: "v2.1",
      lastUsed: "3 days ago",
      usageCount: 342,
    },
    {
      id: "4",
      name: "Slack Messenger",
      description: "Send notifications and messages to Slack channels",
      category: "Communication",
      icon: MessageSquare,
      enabled: true,
      provider: "Slack",
      version: "v1.8",
      lastUsed: "1 hour ago",
      usageCount: 523,
    },
    {
      id: "5",
      name: "API Request",
      description: "Make HTTP requests to external APIs",
      category: "Integration",
      icon: Code,
      enabled: true,
      provider: "Custom",
      version: "v1.0",
      lastUsed: "30 minutes ago",
      usageCount: 2103,
    },
    {
      id: "6",
      name: "Web Scraper",
      description: "Extract data from websites and web pages",
      category: "Data",
      icon: Globe,
      enabled: false,
      provider: "Bright Data",
      version: "v2.5",
      lastUsed: "1 week ago",
      usageCount: 145,
    },
    {
      id: "7",
      name: "Image Generator",
      description: "Generate AI images and visual content",
      category: "AI",
      icon: ImageIcon,
      enabled: true,
      provider: "DALL-E",
      version: "v3.0",
      lastUsed: "5 hours ago",
      usageCount: 89,
    },
    {
      id: "8",
      name: "JSON Parser",
      description: "Parse and transform JSON data structures",
      category: "Data",
      icon: FileJson,
      enabled: true,
      provider: "Built-in",
      version: "v1.2",
      lastUsed: "1 hour ago",
      usageCount: 1567,
    },
  ],
  capabilities: [
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
    {
      id: "2",
      name: "Email Campaign Creation",
      description: "Create personalized outreach campaigns and follow-up sequences",
      score: 88,
      category: "Communication",
      icon: Mail,
      enabled: true,
      accuracy: "92.3%",
      avgTime: "2.8s",
      totalUses: 3421,
      lastImproved: "5 days ago",
    },
    {
      id: "3",
      name: "Behavior Analysis",
      description: "Analyze customer behavior and purchase intent signals",
      score: 92,
      category: "Analytics",
      icon: BarChart3,
      enabled: true,
      accuracy: "95.1%",
      avgTime: "1.8s",
      totalUses: 4156,
      lastImproved: "1 week ago",
    },
    {
      id: "4",
      name: "Lead Scoring",
      description: "Score leads based on engagement and conversion probability",
      score: 85,
      category: "Core",
      icon: LineChart,
      enabled: true,
      accuracy: "89.7%",
      avgTime: "0.9s",
      totalUses: 6789,
      lastImproved: "3 days ago",
    },
    {
      id: "5",
      name: "Conversion Optimization",
      description: "Optimize conversion funnels and reduce cart abandonment",
      score: 79,
      category: "Optimization",
      icon: TrendingUp,
      enabled: false,
      accuracy: "85.4%",
      avgTime: "3.2s",
      totalUses: 1234,
      lastImproved: "2 weeks ago",
    },
    {
      id: "6",
      name: "Customer Segmentation",
      description: "Segment customers based on demographics and behavior patterns",
      score: 90,
      category: "Analytics",
      icon: Users,
      enabled: true,
      accuracy: "93.8%",
      avgTime: "1.5s",
      totalUses: 2890,
      lastImproved: "4 days ago",
    },
    {
      id: "7",
      name: "Workflow Automation",
      description: "Automate repetitive tasks and streamline processes",
      score: 87,
      category: "Automation",
      icon: Workflow,
      enabled: true,
      accuracy: "91.2%",
      avgTime: "2.1s",
      totalUses: 3567,
      lastImproved: "1 week ago",
    },
    {
      id: "8",
      name: "Data Security & Privacy",
      description: "Ensure data security and compliance with privacy regulations",
      score: 96,
      category: "Security",
      icon: Shield,
      enabled: true,
      accuracy: "99.2%",
      avgTime: "0.5s",
      totalUses: 8923,
      lastImproved: "3 weeks ago",
    },
  ],
  performance: {
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
  },
  performanceHistory: [
    { date: "Mon", executions: 156, errors: 4, avgTime: 2.1 },
    { date: "Tue", executions: 189, errors: 3, avgTime: 2.3 },
    { date: "Wed", executions: 178, errors: 5, avgTime: 2.4 },
    { date: "Thu", executions: 203, errors: 2, avgTime: 2.2 },
    { date: "Fri", executions: 198, errors: 6, avgTime: 2.5 },
    { date: "Sat", executions: 167, errors: 3, avgTime: 2.3 },
    { date: "Sun", executions: 156, errors: 4, avgTime: 2.3 },
  ],
  topErrors: [
    { error: "Connection Timeout", count: 12, percentage: 35 },
    { error: "Invalid API Key", count: 8, percentage: 24 },
    { error: "Rate Limit Exceeded", count: 7, percentage: 21 },
    { error: "Data Parsing Error", count: 4, percentage: 12 },
    { error: "Unknown Error", count: 3, percentage: 8 },
  ],
  schedules: [
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
    {
      id: "2",
      name: "Weekly Report Generation",
      description: "Generate and send weekly performance reports to stakeholders",
      cron: "0 18 * * 5",
      enabled: true,
      nextRun: "Friday at 6:00 PM",
      lastRun: "Last Friday at 6:00 PM",
      status: "active" as const,
      frequency: "Weekly",
      timezone: "UTC-5 (EST)",
      executions: 23,
      successRate: 100,
    },
    {
      id: "3",
      name: "Monthly Analysis",
      description: "Perform comprehensive monthly performance analysis",
      cron: "0 10 1 * *",
      enabled: false,
      nextRun: "1st of next month at 10:00 AM",
      lastRun: "1st of this month at 10:00 AM",
      status: "paused" as const,
      frequency: "Monthly",
      timezone: "UTC-5 (EST)",
      executions: 12,
      successRate: 91.7,
    },
    {
      id: "4",
      name: "Hourly Data Sync",
      description: "Sync lead data with CRM systems every hour",
      cron: "0 * * * *",
      enabled: true,
      nextRun: "In 23 minutes",
      lastRun: "37 minutes ago",
      status: "active" as const,
      frequency: "Hourly",
      timezone: "UTC-5 (EST)",
      executions: 892,
      successRate: 99.2,
    },
    {
      id: "5",
      name: "Weekend Campaign Optimizer",
      description: "Optimize email campaigns for weekend sending",
      cron: "0 8 * * 6,0",
      enabled: false,
      nextRun: "Saturday at 8:00 AM",
      lastRun: "Last Sunday at 8:00 AM",
      status: "paused" as const,
      frequency: "Weekends",
      timezone: "UTC-5 (EST)",
      executions: 34,
      successRate: 94.1,
    },
  ],
  activityLogs: [
    { id: "1", action: "Lead Qualification", status: "success", timestamp: "2 minutes ago", duration: "1.2s" },
    { id: "2", action: "Email Campaign", status: "success", timestamp: "15 minutes ago", duration: "3.4s" },
    { id: "3", action: "Behavior Analysis", status: "running", timestamp: "18 minutes ago", duration: "45s" },
    { id: "4", action: "Lead Scoring", status: "failed", timestamp: "1 hour ago", duration: "0.8s" },
  ],
}

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
  const [agent] = useState(mockAgent)
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt)
  const [agentName, setAgentName] = useState(agent.agentName)
  const [agentDescription, setAgentDescription] = useState(agent.agentDescription)
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all")
  const [capabilitySearch, setCapabilitySearch] = useState("")
  const [performanceTimeRange, setPerformanceTimeRange] = useState<string>("7d")

  const handlePromptChange = (value: string) => {
    setSystemPrompt(value)
    setHasChanges(true)
  }

  const handleNameChange = (value: string) => {
    setAgentName(value)
    setHasChanges(true)
  }

  const handleDescriptionChange = (value: string) => {
    setAgentDescription(value)
    setHasChanges(true)
  }

  const handleReset = () => {
    setSystemPrompt(agent.systemPrompt)
    setAgentName(agent.agentName)
    setAgentDescription(agent.agentDescription)
    setHasChanges(false)
  }

  const handleSave = () => {
    console.log("Saving changes...")
    setHasChanges(false)
  }

  const handleStop = () => {
    console.log("Stopping agent...")
  }

  // Filter tools by category and search
  const filteredTools = agent.tools.filter((tool) => {
    const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Get unique categories
  const categories = ["all", ...Array.from(new Set(agent.tools.map((tool) => tool.category)))]

  // Filter capabilities
  const filteredCapabilities = agent.capabilities.filter((capability) => {
    const matchesCategory = capabilityFilter === "all" || capability.category === capabilityFilter
    const matchesSearch =
      capabilitySearch === "" ||
      capability.name.toLowerCase().includes(capabilitySearch.toLowerCase()) ||
      capability.description.toLowerCase().includes(capabilitySearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Get unique capability categories
  const capabilityCategories = ["all", ...Array.from(new Set(agent.capabilities.map((cap) => cap.category)))]

  const getTrendIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-3 w-3" />
    if (change < 0) return <ArrowDown className="h-3 w-3" />
    return <Minus className="h-3 w-3" />
  }

  const getTrendColor = (change: number, inverse = false) => {
    if (inverse) {
      if (change > 0) return "text-red-400"
      if (change < 0) return "text-green-400"
    } else {
      if (change > 0) return "text-green-400"
      if (change < 0) return "text-red-400"
    }
    return "text-gray-400"
  }

  return (
    <div className="min-h-screen bg-bg-lm text-text-lm
    dark:bg-bg dark:text-text font-generalSans">
      <motion.div
        className="container mx-auto px-4 py-8 max-w-7xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
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
                  <AvatarImage src={agent.avatar || "/placeholder.svg"} alt={agent.name} />
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

                <p className="text-gray-400 mb-4 max-w-3xl">{agent.description}</p>

                <div className="flex items-center gap-3 flex-wrap">
                  {agent.tags.map((tag, index) => (
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
                  <span className="text-sm text-text-muted-lm dark:text-text-muted">Last run: {agent.lastRun}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button variant="outline" className="bg-bg-lm dark:bg-bg border-gray-700 dark:border-white hover:bg-info ">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
              <Button
                variant="destructive"
                className="bg-danger-lm dark:bg-danger hover:bg-red-900 border border-red-700"
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
            <TabsList className="bg-gray-900 border-b border-gray-800 justify-start h-auto p-0 rounded-lg">
              <TabsTrigger
                value="configuration"
                className="data-[state=active]:bg-info data-[state=active]:text-white dark:data-[state=active]:bg-info-lm  px-6 py-3 rounded-l-lg"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="data-[state=active]:bg-info data-[state=active]:text-white dark:data-[state=active]:bg-info-lm rounded-none px-6 py-3"
              >
                <Zap className="h-4 w-4 mr-2" />
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="capabilities"
                className="data-[state=active]:bg-info data-[state=active]:text-white dark:data-[state=active]:bg-info-lm rounded-none px-6 py-3"
              >
                <Target className="h-4 w-4 mr-2" />
                Capabilities
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="data-[state=active]:bg-info data-[state=active]:text-white dark:data-[state=active]:bg-info-lm rounded-none px-6 py-3"
              >
                <Activity className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger
                value="scheduling"
                className="data-[state=active]:bg-info data-[state=active]:text-white dark:data-[state=active]:bg-info-lm rounded-none px-6 py-3"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Scheduling
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="data-[state=active]:bg-info data-[state=active]:text-white dark:data-[state=active]:bg-info-lm rounded-r-lg px-6 py-3"
              >
                <FileText className="h-4 w-4 mr-2" />
                Activity Logs
              </TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="configuration" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
                  {/* Header with Actions */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Agent Configuration</h2>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                        onClick={handleReset}
                        disabled={!hasChanges}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </div>

                  {/* System Prompt Section */}
                  <div className="mb-8">
                    <Label className="text-lg font-semibold text-white mb-4 block">System Prompt & Instructions</Label>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => handlePromptChange(e.target.value)}
                      className="min-h-[300px] bg-gray-950 border-gray-700 text-gray-100 font-mono text-sm resize-none"
                      placeholder="Enter system prompt and instructions..."
                    />
                    <p className="text-sm text-gray-500 mt-2">{systemPrompt.length} characters</p>
                  </div>

                  {/* Additional Settings */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Additional Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="agentName" className="text-gray-300 mb-2 block">
                          Agent Name
                        </Label>
                        <Input
                          id="agentName"
                          value={agentName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          className="bg-gray-950 border-gray-700 text-gray-100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description" className="text-gray-300 mb-2 block">
                          Description
                        </Label>
                        <Input
                          id="description"
                          value={agentDescription}
                          onChange={(e) => handleDescriptionChange(e.target.value)}
                          className="bg-gray-950 border-gray-700 text-gray-100"
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
                    <h2 className="text-2xl font-bold text-white mb-2">Available Tools</h2>
                    <p className="text-gray-400">
                      Manage and configure tools for your agent. {agent.tools.filter((t) => t.enabled).length} of{" "}
                      {agent.tools.length} tools enabled.
                    </p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tool
                  </Button>
                </div>

                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search tools..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-gray-900 border-gray-700 text-gray-100"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-48 bg-gray-900 border-gray-700">
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
                        <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                {/* Tool Icon */}
                                <div
                                  className={`h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    tool.enabled
                                      ? "bg-blue-950 border border-blue-800"
                                      : "bg-gray-800 border border-gray-700"
                                  }`}
                                >
                                  <tool.icon
                                    className={`h-7 w-7 ${tool.enabled ? "text-blue-400" : "text-gray-500"}`}
                                  />
                                </div>

                                {/* Tool Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
                                    <Badge variant="outline" className="bg-gray-800 text-gray-400 text-xs">
                                      {tool.category}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-400 mb-3">{tool.description}</p>

                                  {/* Tool Meta */}
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
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
                                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Switch checked={tool.enabled} />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400 hover:text-red-400 hover:bg-red-950/20"
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
                    <Card className="bg-gray-900 border-gray-800">
                      <CardContent className="p-12 text-center">
                        <Zap className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No tools found matching your criteria</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Tools Summary */}
                <Card className="bg-gray-900 border-gray-800 mt-6">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Total Tools</p>
                        <p className="text-2xl font-bold text-white">{agent.tools.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Enabled</p>
                        <p className="text-2xl font-bold text-green-400">
                          {agent.tools.filter((t) => t.enabled).length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Total Usage</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {agent.tools.reduce((sum, t) => sum + t.usageCount, 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Categories</p>
                        <p className="text-2xl font-bold text-purple-400">
                          {new Set(agent.tools.map((t) => t.category)).size}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Capabilities Tab */}
            <TabsContent value="capabilities" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Capabilities Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Agent Capabilities</h2>
                    <p className="text-gray-400">
                      View and manage capabilities. {agent.capabilities.filter((c) => c.enabled).length} of{" "}
                      {agent.capabilities.length} capabilities enabled.
                    </p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Capability
                  </Button>
                </div>

                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search capabilities..."
                      value={capabilitySearch}
                      onChange={(e) => setCapabilitySearch(e.target.value)}
                      className="pl-10 bg-gray-900 border-gray-700 text-gray-100"
                    />
                  </div>
                  <Select value={capabilityFilter} onValueChange={setCapabilityFilter}>
                    <SelectTrigger className="w-full sm:w-48 bg-gray-900 border-gray-700">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      {capabilityCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category === "all" ? "All Categories" : category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Capabilities Grid */}
                <div className="grid gap-4">
                  {filteredCapabilities.length > 0 ? (
                    filteredCapabilities.map((capability, index) => (
                      <motion.div
                        key={capability.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4 flex-1">
                                {/* Capability Icon */}
                                <div
                                  className={`h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    capability.enabled
                                      ? "bg-purple-950 border border-purple-800"
                                      : "bg-gray-800 border border-gray-700"
                                  }`}
                                >
                                  <capability.icon
                                    className={`h-7 w-7 ${capability.enabled ? "text-purple-400" : "text-gray-500"}`}
                                  />
                                </div>

                                {/* Capability Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold text-white">{capability.name}</h3>
                                    <Badge variant="outline" className="bg-gray-800 text-gray-400 text-xs">
                                      {capability.category}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={
                                        capability.score >= 90
                                          ? "bg-green-950/50 text-green-400 border-green-500/50"
                                          : capability.score >= 80
                                            ? "bg-blue-950/50 text-blue-400 border-blue-500/50"
                                            : "bg-yellow-950/50 text-yellow-400 border-yellow-500/50"
                                      }
                                    >
                                      {capability.score}%
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-400 mb-3">{capability.description}</p>

                                  {/* Progress Bar */}
                                  <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
                                    <motion.div
                                      className={`h-2 rounded-full ${
                                        capability.score >= 90
                                          ? "bg-green-600"
                                          : capability.score >= 80
                                            ? "bg-blue-600"
                                            : "bg-yellow-600"
                                      }`}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${capability.score}%` }}
                                      transition={{ duration: 1, delay: index * 0.1 }}
                                    />
                                  </div>

                                  {/* Capability Meta */}
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Target className="h-3 w-3" />
                                      Accuracy: {capability.accuracy}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Avg time: {capability.avgTime}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Activity className="h-3 w-3" />
                                      {capability.totalUses.toLocaleString()} uses
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      Improved {capability.lastImproved}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Capability Actions */}
                              <div className="flex items-center gap-3 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Switch checked={capability.enabled} />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400 hover:text-red-400 hover:bg-red-950/20"
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
                    <Card className="bg-gray-900 border-gray-800">
                      <CardContent className="p-12 text-center">
                        <Target className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No capabilities found matching your criteria</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Capabilities Summary */}
                <Card className="bg-gray-900 border-gray-800 mt-6">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Total Capabilities</p>
                        <p className="text-2xl font-bold text-white">{agent.capabilities.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Enabled</p>
                        <p className="text-2xl font-bold text-green-400">
                          {agent.capabilities.filter((c) => c.enabled).length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Avg Score</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {Math.round(
                            agent.capabilities.reduce((sum, c) => sum + c.score, 0) / agent.capabilities.length,
                          )}
                          %
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Total Uses</p>
                        <p className="text-2xl font-bold text-purple-400">
                          {agent.capabilities.reduce((sum, c) => sum + c.totalUses, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Performance Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Performance Metrics</h2>
                    <p className="text-gray-400">Monitor agent performance and resource utilization</p>
                  </div>
                  <Select value={performanceTimeRange} onValueChange={setPerformanceTimeRange}>
                    <SelectTrigger className="w-48 bg-gray-900 border-gray-700">
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
                    <Card className="bg-gray-900 border-gray-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                          Success Rate
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-400">{agent.performance.successRate}%</div>
                        <p
                          className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.successRateChange)}`}
                        >
                          {getTrendIcon(agent.performance.successRateChange)}
                          {Math.abs(agent.performance.successRateChange)}% from last period
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Card className="bg-gray-900 border-gray-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                          Avg Response Time
                          <Timer className="h-4 w-4 text-blue-400" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-400">{agent.performance.avgResponseTime}</div>
                        <p
                          className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.avgResponseTimeChange, true)}`}
                        >
                          {getTrendIcon(agent.performance.avgResponseTimeChange)}
                          {Math.abs(agent.performance.avgResponseTimeChange)}s from last period
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Card className="bg-gray-900 border-gray-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                          Total Executions
                          <Activity className="h-4 w-4 text-purple-400" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-400">{agent.performance.totalExecutions}</div>
                        <p
                          className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.totalExecutionsChange)}`}
                        >
                          {getTrendIcon(agent.performance.totalExecutionsChange)}
                          {Math.abs(agent.performance.totalExecutionsChange)} from last period
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Card className="bg-gray-900 border-gray-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                          Error Rate
                          <AlertCircle className="h-4 w-4 text-orange-400" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-400">{agent.performance.errorRate}%</div>
                        <p
                          className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.errorRateChange, true)}`}
                        >
                          {getTrendIcon(agent.performance.errorRateChange)}
                          {Math.abs(agent.performance.errorRateChange)}% from last period
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                        Uptime
                        <Gauge className="h-4 w-4 text-cyan-400" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-cyan-400">{agent.performance.uptime}%</div>
                      <p
                        className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.uptimeChange)}`}
                      >
                        {getTrendIcon(agent.performance.uptimeChange)}
                        {Math.abs(agent.performance.uptimeChange)}% from last period
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                        Throughput
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-emerald-400">{agent.performance.throughput}/hr</div>
                      <p
                        className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.throughputChange)}`}
                      >
                        {getTrendIcon(agent.performance.throughputChange)}
                        {Math.abs(agent.performance.throughputChange)} from last period
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                        P95 Latency
                        <Clock className="h-4 w-4 text-yellow-400" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-yellow-400">{agent.performance.latencyP95}</div>
                      <p
                        className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.latencyP95Change, true)}`}
                      >
                        {getTrendIcon(agent.performance.latencyP95Change)}
                        {Math.abs(agent.performance.latencyP95Change)}s from last period
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400 flex items-center justify-between">
                        Memory Usage
                        <HardDrive className="h-4 w-4 text-pink-400" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-pink-400">{agent.performance.memoryUsage}%</div>
                      <p
                        className={`text-xs mt-1 flex items-center gap-1 ${getTrendColor(agent.performance.memoryUsageChange, true)}`}
                      >
                        {getTrendIcon(agent.performance.memoryUsageChange)}
                        {Math.abs(agent.performance.memoryUsageChange)}% from last period
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance Chart */}
                <Card className="bg-gray-900 border-gray-800 mb-6">
                  <CardHeader>
                    <CardTitle className="text-white">Execution Trends</CardTitle>
                    <CardDescription className="text-gray-400">
                      Daily execution count and error rate over the last 7 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <div className="flex items-end justify-between h-full gap-4 px-4">
                        {agent.performanceHistory.map((day, index) => (
                          <motion.div
                            key={day.date}
                            className="flex-1 flex flex-col items-center gap-2"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <div className="w-full flex flex-col items-center gap-1">
                              <motion.div
                                className="w-full bg-blue-600 rounded-t-lg relative"
                                initial={{ height: 0 }}
                                animate={{ height: `${(day.executions / 250) * 100}%` }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                style={{ minHeight: "8px" }}
                              >
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
                                  {day.executions}
                                </span>
                              </motion.div>
                            </div>
                            <span className="text-xs text-gray-500">{day.date}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Error Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">Top Errors</CardTitle>
                      <CardDescription className="text-gray-400">
                        Most frequent errors in the last 7 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {agent.topErrors.map((error, index) => (
                          <motion.div
                            key={error.error}
                            className="space-y-2"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">{error.error}</span>
                              <span className="text-sm text-gray-500">{error.count} occurrences</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <motion.div
                                className="bg-red-600 h-2 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${error.percentage}%` }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                              />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">Resource Utilization</CardTitle>
                      <CardDescription className="text-gray-400">Current resource consumption</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-blue-400" />
                              <span className="text-sm text-gray-300">CPU Usage</span>
                            </div>
                            <span className="text-sm text-gray-500">45%</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <motion.div
                              className="bg-blue-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: "45%" }}
                              transition={{ duration: 1 }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-4 w-4 text-pink-400" />
                              <span className="text-sm text-gray-300">Memory</span>
                            </div>
                            <span className="text-sm text-gray-500">{agent.performance.memoryUsage}%</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <motion.div
                              className="bg-pink-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${agent.performance.memoryUsage}%` }}
                              transition={{ duration: 1, delay: 0.2 }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-purple-400" />
                              <span className="text-sm text-gray-300">Storage</span>
                            </div>
                            <span className="text-sm text-gray-500">32%</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <motion.div
                              className="bg-purple-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: "32%" }}
                              transition={{ duration: 1, delay: 0.4 }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-green-400" />
                              <span className="text-sm text-gray-300">Network I/O</span>
                            </div>
                            <span className="text-sm text-gray-500">28%</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <motion.div
                              className="bg-green-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: "28%" }}
                              transition={{ duration: 1, delay: 0.6 }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </TabsContent>

            {/* Scheduling Tab */}
            <TabsContent value="scheduling" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                {/* Scheduling Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Scheduled Tasks</h2>
                    <p className="text-gray-400">
                      Manage automated execution schedules. {agent.schedules.filter((s) => s.enabled).length} of{" "}
                      {agent.schedules.length} schedules active.
                    </p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                </div>

                {/* Schedule Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Total Schedules</span>
                        <Calendar className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-white">{agent.schedules.length}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Active</span>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      </div>
                      <div className="text-2xl font-bold text-green-400">
                        {agent.schedules.filter((s) => s.enabled).length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Total Executions</span>
                        <Activity className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="text-2xl font-bold text-purple-400">
                        {agent.schedules.reduce((sum, s) => sum + s.executions, 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Avg Success Rate</span>
                        <Target className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="text-2xl font-bold text-cyan-400">
                        {Math.round(
                          agent.schedules.reduce((sum, s) => sum + s.successRate, 0) / agent.schedules.length,
                        )}
                        %
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Schedules List */}
                <div className="space-y-4">
                  {agent.schedules.map((schedule, index) => (
                    <motion.div
                      key={schedule.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card
                        className={`bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors ${
                          schedule.enabled ? "border-l-4 border-l-green-500" : "border-l-4 border-l-gray-600"
                        }`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-4 flex-1">
                              {/* Schedule Icon */}
                              <div
                                className={`h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  schedule.enabled
                                    ? "bg-green-950 border border-green-800"
                                    : "bg-gray-800 border border-gray-700"
                                }`}
                              >
                                <Calendar
                                  className={`h-7 w-7 ${schedule.enabled ? "text-green-400" : "text-gray-500"}`}
                                />
                              </div>

                              {/* Schedule Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-semibold text-white">{schedule.name}</h3>
                                  <Badge
                                    variant="outline"
                                    className={
                                      schedule.status === "active"
                                        ? "bg-green-950/50 text-green-400 border-green-500/50"
                                        : "bg-gray-800 text-gray-400 border-gray-600"
                                    }
                                  >
                                    {schedule.status === "active" ? (
                                      <>
                                        <span className="relative flex h-2 w-2 mr-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        Active
                                      </>
                                    ) : (
                                      "Paused"
                                    )}
                                  </Badge>
                                  <Badge variant="outline" className="bg-gray-800 text-gray-400 text-xs">
                                    {schedule.frequency}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-400 mb-4">{schedule.description}</p>

                                {/* Schedule Details Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Cron Expression</p>
                                    <p className="text-sm text-gray-300 font-mono">{schedule.cron}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Timezone</p>
                                    <p className="text-sm text-gray-300">{schedule.timezone}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Next Run</p>
                                    <p className="text-sm text-gray-300 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {schedule.nextRun}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Last Run</p>
                                    <p className="text-sm text-gray-300 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {schedule.lastRun}
                                    </p>
                                  </div>
                                </div>

                                {/* Performance Stats */}
                                <div className="flex items-center gap-6 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    {schedule.executions.toLocaleString()} executions
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    {schedule.successRate}% success rate
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Schedule Actions */}
                            <div className="flex items-center gap-3 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <div className="flex items-center gap-2">
                                <Switch checked={schedule.enabled} />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-red-400 hover:bg-red-950/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Empty State (shown when no schedules) */}
                {agent.schedules.length === 0 && (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-12 text-center">
                      <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">No Schedules Yet</h3>
                      <p className="text-gray-400 mb-4">Create your first schedule to automate agent execution</p>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Schedule
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* Activity Logs Tab */}
            <TabsContent value="logs" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Activity Logs</h2>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-48 bg-gray-900 border-gray-700">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activities</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  {agent.activityLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card
                        className={`bg-gray-900 border-gray-800 ${
                          log.status === "success"
                            ? "border-l-4 border-l-green-500"
                            : log.status === "running"
                              ? "border-l-4 border-l-blue-500"
                              : "border-l-4 border-l-red-500"
                        }`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {log.status === "success" ? (
                                <CheckCircle className="h-6 w-6 text-green-400" />
                              ) : log.status === "running" ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                                >
                                  <Clock className="h-6 w-6 text-blue-400" />
                                </motion.div>
                              ) : (
                                <AlertCircle className="h-6 w-6 text-red-400" />
                              )}
                              <div>
                                <h3 className="text-lg font-semibold text-white">{log.action}</h3>
                                <p className="text-sm text-gray-400">{log.timestamp}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant="outline"
                                className={
                                  log.status === "success"
                                    ? "bg-green-950/50 text-green-400 border-green-500/50"
                                    : log.status === "running"
                                      ? "bg-blue-950/50 text-blue-400 border-blue-500/50"
                                      : "bg-red-950/50 text-red-400 border-red-500/50"
                                }
                              >
                                {log.status}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">{log.duration}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  )
}

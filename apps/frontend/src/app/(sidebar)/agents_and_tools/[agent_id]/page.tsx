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
    { id: "1", name: "Google Search", description: "Search the web for information", icon: Search, enabled: true },
    { id: "2", name: "Email Sender", description: "Send automated emails", icon: Mail, enabled: true },
    { id: "3", name: "CRM Integration", description: "Connect to CRM systems", icon: Database, enabled: false },
    { id: "4", name: "Slack Messenger", description: "Send messages to Slack", icon: MessageSquare, enabled: true },
  ],
  capabilities: [
    { name: "Lead Qualification", score: 95, description: "Identify high-value prospects" },
    { name: "Email Campaigns", score: 88, description: "Create personalized outreach" },
    { name: "Behavior Analysis", score: 92, description: "Analyze customer patterns" },
    { name: "Lead Scoring", score: 85, description: "Score based on engagement" },
  ],
  performance: {
    successRate: 94.2,
    avgResponseTime: "2.3s",
    totalExecutions: 1247,
    errorRate: 2.1,
  },
  schedules: [
    { id: "1", name: "Daily Lead Scan", cron: "0 9 * * *", enabled: true, nextRun: "Tomorrow at 9:00 AM" },
    { id: "2", name: "Weekly Report", cron: "0 18 * * 5", enabled: true, nextRun: "Friday at 6:00 PM" },
    { id: "3", name: "Monthly Analysis", cron: "0 10 1 * *", enabled: false, nextRun: "1st of next month" },
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-generalSans">
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
                <Avatar className="h-20 w-20 border-2 border-blue-500/50">
                  <AvatarImage src={agent.avatar || "/placeholder.svg"} alt={agent.name} />
                  <AvatarFallback className="bg-blue-950 text-blue-300">
                    <Bot className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
              </motion.div>

              {/* Agent Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-white">{agent.name}</h1>
                  <Badge variant="outline" className="bg-green-950/50 text-green-400 border-green-500/50">
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
                      <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                        {tag}
                      </Badge>
                    </motion.div>
                  ))}
                  <span className="text-sm text-gray-500">Last run: {agent.lastRun}</span>
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
              <Button variant="outline" className="bg-gray-900 border-gray-700 hover:bg-gray-800">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
              <Button
                variant="destructive"
                className="bg-red-900/50 hover:bg-red-900 border border-red-700"
                onClick={handleStop}
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
              <Button variant="ghost" size="icon" className="bg-gray-900 hover:bg-gray-800">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Tabs Navigation */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="configuration" className="w-full">
            <TabsList className="bg-gray-900 border-b border-gray-800 w-full justify-start rounded-none h-auto p-0">
              <TabsTrigger
                value="configuration"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-6 py-3"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-6 py-3"
              >
                <Zap className="h-4 w-4 mr-2" />
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="capabilities"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-6 py-3"
              >
                <Target className="h-4 w-4 mr-2" />
                Capabilities
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-6 py-3"
              >
                <Activity className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger
                value="scheduling"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-6 py-3"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Scheduling
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-6 py-3"
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
                <div className="grid gap-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white">Available Tools</h2>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tool
                    </Button>
                  </div>
                  {agent.tools.map((tool, index) => (
                    <motion.div
                      key={tool.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-gray-900 border-gray-800">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-lg bg-blue-950 flex items-center justify-center">
                                <tool.icon className="h-6 w-6 text-blue-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
                                <p className="text-sm text-gray-400">{tool.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Switch checked={tool.enabled} />
                              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            {/* Capabilities Tab */}
            <TabsContent value="capabilities" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="grid gap-6">
                  <h2 className="text-2xl font-bold text-white mb-4">Agent Capabilities</h2>
                  {agent.capabilities.map((capability, index) => (
                    <motion.div
                      key={capability.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-gray-900 border-gray-800">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-white">{capability.name}</CardTitle>
                            <Badge
                              variant="outline"
                              className={
                                capability.score >= 90
                                  ? "bg-green-950/50 text-green-400 border-green-500/50"
                                  : "bg-blue-950/50 text-blue-400 border-blue-500/50"
                              }
                            >
                              {capability.score}%
                            </Badge>
                          </div>
                          <CardDescription className="text-gray-400">{capability.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <motion.div
                              className="bg-blue-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${capability.score}%` }}
                              transition={{ duration: 1, delay: index * 0.2 }}
                            />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400">Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-400">{agent.performance.successRate}%</div>
                      <p className="text-xs text-gray-500 mt-1">
                        <TrendingUp className="inline h-3 w-3 mr-1" />
                        Up from last week
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400">Avg Response Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-400">{agent.performance.avgResponseTime}</div>
                      <p className="text-xs text-gray-500 mt-1">
                        <Clock className="inline h-3 w-3 mr-1" />
                        Per execution
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400">Total Executions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-purple-400">{agent.performance.totalExecutions}</div>
                      <p className="text-xs text-gray-500 mt-1">
                        <Activity className="inline h-3 w-3 mr-1" />
                        All time
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400">Error Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-400">{agent.performance.errorRate}%</div>
                      <p className="text-xs text-gray-500 mt-1">
                        <AlertCircle className="inline h-3 w-3 mr-1" />
                        Last 30 days
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white">Performance Chart</CardTitle>
                    <CardDescription className="text-gray-400">
                      Agent execution metrics over the last 7 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <Activity className="h-12 w-12 mr-4" />
                      <span>Performance chart visualization would go here</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Scheduling Tab */}
            <TabsContent value="scheduling" className="mt-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Scheduled Tasks</h2>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                </div>
                <div className="grid gap-4">
                  {agent.schedules.map((schedule, index) => (
                    <motion.div
                      key={schedule.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-gray-900 border-gray-800">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-lg bg-purple-950 flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-purple-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-white">{schedule.name}</h3>
                                <p className="text-sm text-gray-400">Cron: {schedule.cron}</p>
                                <p className="text-xs text-gray-500 mt-1">Next run: {schedule.nextRun}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Switch checked={schedule.enabled} />
                              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
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

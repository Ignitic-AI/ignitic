"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Upload,
  Settings,
  FileText,
  Users,
  Eye,
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Rocket,
  BarChart3,
  MonitorDot,
} from "lucide-react"
import { motion } from "framer-motion"

// Template data
const templates = [
  {
    id: 1,
    name: "Email Marketing Automation",
    description: "Automated email campaigns with customer segmentation",
    category: "Marketing",
    uses: 1250,
    rating: 4.8,
    steps: ["Email", "Filter", "Send"],
    color: "text-muted-lm dark:text-highlight-lm",
  },
  {
    id: 2,
    name: "Slack to Notion Sync",
    description: "Sync messages from Slack channels to Notion pages",
    category: "Productivity",
    uses: 890,
    rating: 4.6,
    steps: ["Slack", "Process", "Notion"],
    color: "text-muted-lm dark:text-highlight-lm",
  },
  {
    id: 3,
    name: "GitHub Issue Tracker",
    description: "Track and manage GitHub issues with notifications",
    category: "Development",
    uses: 670,
    rating: 4.7,
    steps: ["GitHub", "Filter", "Notify"],
    color: "text-muted-lm dark:text-highlight-lm",
  },
  {
    id: 4,
    name: "Customer Data Pipeline",
    description: "Process and enrich customer data automatically",
    category: "Data",
    uses: 445,
    rating: 4.5,
    steps: ["API", "Transform", "Database"],
    color: "text-muted-lm dark:text-highlight-lm",
  },
]

// Recent executions data
const recentExecutions = [
  {
    id: 1,
    name: "Email Campaign Automation",
    time: "10:30 AM",
    duration: "2.3s",
    status: "success" as const,
  },
  {
    id: 2,
    name: "Data Sync Pipeline",
    time: "10:25 AM",
    duration: "45s",
    status: "running" as const,
  },
  {
    id: 3,
    name: "Slack Notification Workflow",
    time: "10:20 AM",
    duration: "1.2s",
    status: "success" as const,
  },
  {
    id: 4,
    name: "GitHub Issue Sync",
    time: "10:15 AM",
    duration: "3.1s",
    status: "failed" as const,
  },
]

export default function WorkflowsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isLoaded, setIsLoaded] = useState(false)

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const quickActions = [
    { icon: Plus, label: "Create", color: "dark:text-text text-text-lm" },
    { icon: Rocket, label: "Deploy", color: "dark:text-text text-text-lm" },
    { icon: FileText, label: "Logs", color: "dark:text-text text-text-lm" },
    { icon: MonitorDot, label: "Monitor", color: "dark:text-text text-text-lm" },
    { icon: Users, label: "Users", color: "dark:text-text text-text-lm" },
    { icon: BarChart3, label: "Analytics", color: "dark:text-text text-text-lm" },
  ]

  // Set loaded state after component mounts
  useState(() => {
    setIsLoaded(true)
  })

  return (
    <motion.div 
      className="py-4 px-10 font-generalSans" 
      initial={{ opacity: 0 }}
      animate={{ opacity: isLoaded ? 1 : 0 }}
      transition={{ duration: 0.3, ease: "easeIn" }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: isLoaded ? 1 : 0, x: isLoaded ? 0 : -30 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
        >
          <motion.h1
            className="text-3xl font-bold font-generalSans text-bg-dark dark:text-bg-dark-lm flex items-center gap-3"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: isLoaded ? 1 : 0, x: isLoaded ? 0 : -50 }}
            transition={{ duration: 0.6, ease: "easeIn", delay: 0.3 }}
          >
            Workflow Manager
          </motion.h1>
          <motion.p
            className="text-text-lm dark:text-text mt-1 mb-4 font-generalSans"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Automate your workflows with ease
          </motion.p>
        </motion.div>
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeIn", delay: 0.3 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Button variant="outline" className="gap-2 font-generalSans bg-transparent">
              <Upload className="w-4 h-4" />
              Import
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          >
            <Button className="bg-info-lm dark:bg-info hover:bg-text-lm hover:dark:bg-text gap-2 font-generalSans font-medium">
              <Plus className="w-4 h-4" />
              New Workflow
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
          >
            <Button variant="outline" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-generalSans -mb-2">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {quickActions.map((action, index) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        duration: 0.1, 
                        ease: [0.25, 0.1, 0.25, 1],
                        delay: index * 0.1
                      }}
                      whileHover={{
                        scale: 1.08,
                        y: -4,
                        transition: { duration: 0.2 },
                      }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:border-border-lm dark:hover:border-border hover:bg-invite dark:hover:bg-info hover:shadow-md transition-all"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: 0.6 + index * 0.1,
                          type: "spring",
                          stiffness: 200,
                          damping: 15,
                        }}
                      >
                        <action.icon className={`w-6 h-6 ${action.color}`} />
                      </motion.div>
                      <span className="text-sm font-medium font-generalSans">{action.label}</span>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Template Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-generalSans -mb-2">Template Gallery</CardTitle>
                  <Button variant="link" className="text-text-lm dark:text-text font-generalSans">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter */}
                <motion.div
                  className="flex gap-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 font-generalSans"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[200px] font-generalSans">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Productivity">Productivity</SelectItem>
                      <SelectItem value="Development">Development</SelectItem>
                      <SelectItem value="Data">Data</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>

                {/* Templates Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredTemplates.map((template, index) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        ease: [0.25, 0.1, 0.25, 1],
                        delay: index * 0.1
                      }}
                      whileHover={{
                        scale: 1.03,
                        y: -5,
                        transition: { duration: 0.2 },
                      }}
                    >
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer group border-2 border-transparent hover:border-purple-200 border-border-lm dark:border-border">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold font-generalSans text-text-muted-lm dark:text-text-muted text-lg">
                                {template.name}
                              </h3>
                              <p className="text-sm text-info-lm dark:text-info mt-1 font-generalSans">{template.description}</p>
                            </div>
                            <motion.div
                              initial={{ opacity: 0, scale: 0 }}
                              whileHover={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </motion.div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-generalSans bg-info">
                              {template.category}
                            </Badge>
                            <span className="text-sm text-muted-lm font-generalSans">{template.uses}</span>
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-generalSans">{template.rating}</span>
                            </div>
                          </div>

                          <motion.div
                            className="flex items-center gap-2 text-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 + index * 0.1 }}
                          >
                            {template.steps.map((step, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <motion.span
                                  className={`font-medium font-generalSans ${template.color}`}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 1.2 + idx * 0.1 }}
                                >
                                  {step}
                                </motion.span>
                                {idx < template.steps.length - 1 && (
                                  <motion.span
                                    className="text-gray-400"
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 1.3 + idx * 0.1 }}
                                  >
                                    →
                                  </motion.span>
                                )}
                              </div>
                            ))}
                          </motion.div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Executions */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-generalSans">Recent Executions</CardTitle>
                  <Button variant="link" className="text-text-lm dark:text-text font-generalSans">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentExecutions.map((execution, index) => (
                    <motion.div
                      key={execution.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        ease: [0.25, 0.1, 0.25, 1],
                        delay: index * 0.1
                      }}
                      whileHover={{
                        scale: 1.02,
                        x: 5,
                        transition: { duration: 0.2 },
                      }}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        execution.status === "success"
                          ? "bg-green-50 border border-green-200"
                          : execution.status === "running"
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-red-50 border border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            delay: 1.5 + index * 0.1,
                            type: "spring",
                            stiffness: 200,
                          }}
                        >
                          {execution.status === "success" ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : execution.status === "running" ? (
                            <Clock className="w-5 h-5 text-blue-600 animate-spin" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </motion.div>
                        <div>
                          <p className="font-medium font-generalSans text-bg-dark">{execution.name}</p>
                          <p className="text-sm text-gray-600 font-generalSans">{execution.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium font-generalSans">{execution.duration}</p>
                        <p
                          className={`text-sm font-generalSans ${
                            execution.status === "success"
                              ? "text-green-600"
                              : execution.status === "running"
                                ? "text-blue-600"
                                : "text-red-600"
                          }`}
                        >
                          {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Sidebar */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {/* System Status */}
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            transition={{ duration: 0.2 }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-generalSans">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  className="flex items-center justify-between"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <span className="text-sm text-gray-600 font-generalSans">Connection</span>
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-2 h-2 bg-green-500 rounded-full"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.8, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <span className="text-sm font-medium text-green-600 font-generalSans">Connected</span>
                  </div>
                </motion.div>
                {[
                  { label: "Workflows", value: "18/24" },
                  { label: "Credentials", value: "12" },
                  { label: "Version", value: "1.15.2" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="flex items-center justify-between"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                  >
                    <span className="text-sm text-gray-600 font-generalSans">{item.label}</span>
                    <span className="text-sm font-medium font-generalSans">{item.value}</span>
                  </motion.div>
                ))}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
                  <Button variant="outline" className="w-full mt-4 font-generalSans bg-transparent">
                    Manage Connections
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Monitoring */}
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            transition={{ duration: 0.2 }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-generalSans">Monitoring</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Success Rate", value: "94.2%", color: "text-green-600" },
                  { label: "Last Success", value: "2m ago", color: "" },
                  { label: "Failed", value: "3", color: "text-red-600" },
                  { label: "Avg Time", value: "3.2s", color: "" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="flex items-center justify-between"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + index * 0.1 }}
                  >
                    <span className="text-sm text-gray-600 font-generalSans">{item.label}</span>
                    <span className={`text-sm font-semibold font-generalSans ${item.color}`}>{item.value}</span>
                  </motion.div>
                ))}

                {/* Recent Errors */}
                <motion.div
                  className="mt-4 pt-4 border-t"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium font-generalSans">Recent Errors</span>
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </motion.div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600 font-generalSans">Connection timeout (10:15 AM)</p>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            transition={{ duration: 0.2 }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-generalSans">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Total", value: "24", color: "purple" },
                    { label: "Active", value: "18", color: "green" },
                    { label: "Today", value: "156", color: "blue" },
                    { label: "Success", value: "94%", color: "orange" },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{
                        duration: 0.6,
                        ease: [0.34, 1.56, 0.64, 1],
                        delay: index * 0.1
                      }}
                      whileHover={{
                        scale: 1.1,
                        rotate: 3,
                        transition: { duration: 0.2 },
                      }}
                      className={`text-center p-4 bg-${stat.color}-50 rounded-lg cursor-pointer`}
                    >
                      <motion.div
                        className={`text-3xl font-bold text-${stat.color}-600 font-generalSans`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: 1.5 + index * 0.1,
                          type: "spring",
                          stiffness: 200,
                        }}
                      >
                        {stat.value}
                      </motion.div>
                      <div className="text-sm text-gray-600 mt-1 font-generalSans">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
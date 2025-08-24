'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Mock data for metrics
const metrics = {
  activeAgents: 4,
  totalTools: [24, 3],
  totalExecution: [3, 3],
  additionalMetrics: [3, 3],
  agentDetails: [
    { name: "LeadBot", status: "Active", performance: "98%", type: "Lead Generation" },
    { name: "EmailBot", status: "Active", performance: "95%", type: "Email Marketing" },
    { name: "AnalyticsBot", status: "Active", performance: "92%", type: "Data Analysis" },
    { name: "SupportBot", status: "Active", performance: "89%", type: "Customer Support" }
  ]
}

export function DashboardMetrics() {
  return (
    <div className="space-y-2">
      {/* Active Agents - Enhanced with more details */}
      <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-1">
          <CardTitle className="text-base font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent font-generalSans">
            ACTIVE AGENTS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Main Stats */}
            <div className="text-center lg:text-left">
              <div className="text-3xl font-bold text-teal-600 mb-1 font-generalSans hover:scale-110 transition-transform duration-300 cursor-pointer">
                {metrics.activeAgents}
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-1 text-xs text-slate-500 mb-2">
                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="font-medium">+12% from last month</span>
              </div>
            </div>
            
            {/* Agent Details Grid */}
            <div className="grid grid-cols-2 gap-1">
              {metrics.agentDetails.map((agent, index) => (
                <div key={index} className="p-1 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-200 hover:shadow-md hover:scale-105 hover:bg-gradient-to-r hover:from-teal-100 hover:to-blue-100 transition-all duration-300 cursor-pointer group">
                  <div className="text-xs font-bold text-teal-700 group-hover:text-teal-800 transition-colors">{agent.name}</div>
                  <div className="text-xs text-slate-600 group-hover:text-slate-700 transition-colors">{agent.type}</div>
                  <div className="text-xs font-semibold text-green-600 group-hover:text-green-700 group-hover:scale-110 transition-all duration-300">{agent.performance}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-1">
          <CardTitle className="text-base font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent font-generalSans">
            PERFORMANCE METRICS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {/* Total Tools */}
            <div className="text-center p-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:shadow-lg hover:scale-105 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 cursor-pointer group">
              <div className="text-lg font-bold text-blue-600 mb-1 font-generalSans group-hover:text-blue-700 group-hover:scale-110 transition-all duration-300">
                {metrics.totalTools[0]}
              </div>
              <div className="text-xs text-slate-600 font-medium group-hover:text-slate-700 transition-colors">Total Tools</div>
            </div>
            
            {/* Tools in Use */}
            <div className="text-center p-1.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 hover:shadow-lg hover:scale-105 hover:bg-gradient-to-r hover:from-green-100 hover:to-emerald-100 transition-all duration-300 cursor-pointer group">
              <div className="text-lg font-bold text-green-600 mb-1 font-generalSans group-hover:text-green-700 group-hover:scale-110 transition-all duration-300">
                {metrics.totalTools[1]}
              </div>
              <div className="text-xs text-slate-600 font-medium group-hover:text-slate-700 transition-colors">In Use</div>
            </div>
            
            {/* Today's Executions */}
            <div className="text-center p-1.5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 hover:shadow-lg hover:scale-105 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 transition-all duration-300 cursor-pointer group">
              <div className="text-lg font-bold text-purple-600 mb-1 font-generalSans group-hover:text-purple-700 group-hover:scale-110 transition-all duration-300">
                {metrics.totalExecution[0]}
              </div>
              <div className="text-xs text-slate-600 font-medium group-hover:text-slate-700 transition-colors">Today</div>
            </div>
            
            {/* Week's Executions */}
            <div className="text-center p-1.5 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200 hover:shadow-lg hover:scale-105 hover:bg-gradient-to-r hover:from-orange-100 hover:to-red-100 transition-all duration-300 cursor-pointer group">
              <div className="text-lg font-bold text-orange-600 mb-1 font-generalSans group-hover:text-orange-700 group-hover:scale-110 transition-all duration-300">
                {metrics.totalExecution[1]}
              </div>
              <div className="text-xs text-slate-600 font-medium group-hover:text-slate-700 transition-colors">This Week</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

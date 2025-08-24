'use client'

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

  return (
    <div className="space-y-6">
      {/* Active Agents - Enhanced with more details */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Active Agents</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Stats */}
          <div className="text-center lg:text-left">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {metrics.activeAgents}
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-2 text-sm text-slate-600 mb-3">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-medium">+12% from last month</span>
            </div>
          </div>
          
          {/* Agent Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {metrics.agentDetails.map((agent, index) => (
              <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm font-semibold text-slate-700 mb-1">{agent.name}</div>
                <div className="text-xs text-slate-600 mb-1">{agent.type}</div>
                <div className="text-sm font-semibold text-green-600">{agent.performance}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Performance Metrics</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {/* Total Tools */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {metrics.totalTools[0]}
            </div>
            <div className="text-sm text-slate-600">Total Tools</div>
          </div>
          
          {/* Tools in Use */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-2xl font-bold text-green-600 mb-2">
              {metrics.totalTools[1]}
            </div>
            <div className="text-sm text-slate-600">In Use</div>
          </div>
          
          {/* Today's Executions */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-2xl font-bold text-purple-600 mb-2">
              {metrics.totalExecution[0]}
            </div>
            <div className="text-sm text-slate-600">Today</div>
          </div>
          
          {/* Week's Executions */}
          <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-2xl font-bold text-orange-600 mb-2">
              {metrics.totalExecution[1]}
            </div>
            <div className="text-sm text-slate-600">This Week</div>
          </div>
        </div>
      </div>
    </div>
  )
}

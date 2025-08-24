import { PromptBox } from "@/components/PromptBox"
import { Checklist } from "@/components/Checklist"
import { DashboardMetrics } from "@/components/DashboardMetrics"
import { ChartsSection } from "@/components/ChartsSection"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-2 p-3 bg-gradient-to-br from-slate-50/50 via-blue-50/30 to-indigo-100/50 min-h-full">
      {/* Top Section - AI Suggestions (Full Width) */}
      <div className="w-full">
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-3 border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-generalSans">AI Suggestions</h3>
                <p className="text-xs text-slate-600 font-medium">(Based on Workflows)</p>
              </div>
            </div>
            <button className="p-1 hover:bg-white rounded-lg transition-colors">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Second Section - Automate Tab and To-do List Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Left Column - Prompt Box */}
        <div className="lg:col-span-1">
          <PromptBox />
        </div>

        {/* Right Column - To-do List */}
        <div className="lg:col-span-1">
          <Checklist />
        </div>
      </div>

      {/* Third Section - Analytics Charts and Quick Insights (Fill remaining space) */}
      <div className="w-full">
        <ChartsSection />
      </div>

      {/* Fourth Section - Active Agents and Performance Metrics */}
      <div className="w-full">
        <DashboardMetrics />
      </div>
    </div>
  )
}

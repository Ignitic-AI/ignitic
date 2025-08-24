import { PromptBox } from "@/components/PromptBox"
import { Checklist } from "@/components/Checklist"
import { DashboardMetrics } from "@/components/DashboardMetrics"
import { ChartsSection } from "@/components/ChartsSection"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6 bg-slate-50 min-h-full">
      {/* Top Section - AI Suggestions (Full Width) */}
      <div className="w-full">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-800">AI Suggestions</h3>
                <p className="text-sm text-slate-600">Based on Workflows</p>
              </div>
            </div>
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Second Section - Automate Tab and To-do List Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Prompt Box (Increased to 2 columns) */}
        <div className="lg:col-span-2">
          <PromptBox />
        </div>

        {/* Right Column - To-do List (1 column) */}
        <div className="lg:col-span-1">
          <Checklist />
        </div>
      </div>

      {/* Third Section - Analytics Charts and Quick Insights */}
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

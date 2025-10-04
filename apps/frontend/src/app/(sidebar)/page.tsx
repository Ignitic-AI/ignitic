import { PromptBox } from '@/components/PromptBox'
import { Checklist } from '@/components/Checklist'
import { ChartsSection } from '@/components/ChartsSection'
import { DashboardMetrics } from '@/components/DashboardMetrics'
import { AISuggestions } from '@/components/AISuggestions'

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-0 p-6 bg-bg-dark-lm dark:bg-bg-dark min-h-full font-generalSans">
      {/* Top Section - Automation Box (Full Width) */}
      <div className="w-full p-2">
        <PromptBox />
      </div>

      {/* Second Section - AI Suggestions and To-do List Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Left Column - AI Suggestions (2 columns) */}
        <div className="lg:col-span-2 p-2">
          <AISuggestions />
        </div>

        {/* Right Column - To-do List (1 column) */}
        <div className="lg:col-span-1 p-2">
          <Checklist />
        </div>
      </div>

      {/* Third Section - Analytics Charts and Quick Insights */}
      <div className="w-full -mt-2">
        <ChartsSection />
      </div>

      {/* Fourth Section - Active Agents and Performance Metrics */}
      <div className="w-full">
        <DashboardMetrics />
      </div>
    </div>
  )
}

"use client"

import { PromptBox } from '@/components/PromptBox'
import { Checklist } from '@/components/Checklist'
import { ChartsSection } from '@/components/ChartsSection'
import { DashboardMetrics } from '@/components/DashboardMetrics'
import { AISuggestions } from '@/components/AISuggestions'


export default function Home() {
 
  

  return (
    <div className="flex flex-1 flex-col gap-0 p-6 bg-bg-dark-lm dark:bg-bg-dark min-h-full font-generalSans">
      {/* Top Section - Automation Box (Full Width) */}
      <div className="w-full p-2 mt-20 mb-20">
        <PromptBox />
      </div>

      {/* Second Section - AI Suggestions and To-do List Side by Side */}
      <div className="grid grid-cols-1 gap-1 lg:grid-cols-12">
        {/* Left Column - AI Suggestions */}
        <div className="lg:col-span-7 p-1">
          <AISuggestions />
        </div>

        {/* Right Column - To-do List */}
        <div className="lg:col-span-5 p-1">
          <Checklist />
        </div>
      </div>

      {/* Third Section - Analytics Charts and Quick Insights */}
      {/* <div className="w-full -mt-2">
        <ChartsSection />
      </div> */}

      {/* Fourth Section - Active Agents and Performance Metrics */}
      <div className="w-full">
        <DashboardMetrics />
      </div>
    </div>
  )
}

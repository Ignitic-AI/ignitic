"use client"

import { PieChart, BarChart, LineChart, Activity } from "lucide-react"

export const AVAILABLE_CHARTS = [
  { id: "bar", type: "bar", label: "Bar Chart", icon: <BarChart className="w-5 h-5" /> },
  { id: "line", type: "line", label: "Line Chart", icon: <LineChart className="w-5 h-5" /> },
  { id: "pie", type: "pie", label: "Pie Chart", icon: <PieChart className="w-5 h-5" /> },
  { id: "area", type: "area", label: "Area Chart", icon: <Activity className="w-5 h-5" /> },
]

export function DraggableChartSidebar() {
  return (
    <aside className="w-64 border-r border-border bg-white/5 backdrop-blur-xl h-vh sticky  overflow-y-auto scrollbar-hide p-4 hidden md:block">
      <h2 className="text-sm font-semibold text-muted-foreground/70 mb-3 uppercase tracking-wider px-2 pt-5">Available Charts</h2>
      <div className="space-y-4">
        {AVAILABLE_CHARTS.map((chart) => (
          <div
            key={chart.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/json", JSON.stringify({ type: "chart-type", chartType: chart.id }))
              e.dataTransfer.effectAllowed = "copy"
            }}
            className="w-full bg-card/40 hover:bg-card/80 border border-border/40 hover:border-primary/20 rounded-xl p-1 transition-all duration-300 hover:shadow-lg cursor-grab active:cursor-grabbing group"
          >
            {/* Sidebar Representation */}
            <div className="sidebar-content w-full p-3 flex !flex-row !items-center gap-3 flex-nowrap">
              <div className="flex-shrink-0 w-fit p-1 rounded-lg text-muted-foreground group-hover:text-primary transition-colors">
                {chart.icon}
              </div>

              <span className="min-w-0 truncate font-medium text-sm text-foreground/80 group-hover:text-foreground">
                {chart.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

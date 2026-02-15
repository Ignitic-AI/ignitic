"use client"

import { useState } from "react"
import { GenericBarChart, GenericAreaChart, GenericLineChart, GenericPieChart } from "./ChartComponents"
import { MOCK_ANALYTICS_DATA } from "./MockAnalyticsData"
import { Database, Plus, TrendingUp, X } from "lucide-react"

interface DynamicChartProps {
  type: string
  dataId: string | null
  onDropData: (dataId: string) => void
}

export function DynamicChart({ type, dataId, onDropData }: DynamicChartProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Optional: Check if dragged item is a data-source
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    try {
      const startData = e.dataTransfer.getData("application/json")
      if (startData) {
        const data = JSON.parse(startData)
        if (data.type === "data-source" && data.id) {
          onDropData(data.id)
        }
      }
    } catch (err) {
      console.error("Failed to parse drop data", err)
    }
  }

  const chartData = dataId && MOCK_ANALYTICS_DATA[dataId] 
    ? MOCK_ANALYTICS_DATA[dataId] 
    : null

  const renderChart = () => {
    if (!chartData) return null

    const props = {
      data: chartData.data,
      label: chartData.label,
      color: chartData.color
    }

    switch (type) {
      case "bar": return <GenericBarChart {...props} />
      case "line": return <GenericLineChart {...props} />
      case "area": return <GenericAreaChart {...props} />
      case "pie": return <GenericPieChart {...props} />
      default: return <div className="p-4 text-red-500">Unknown chart type: {type}</div>
    }
  }

  if (chartData) {
    return (
      <div 
        className={`w-full h-full relative group transition-all duration-300 rounded-xl overflow-hidden
          ${isDragOver ? 'ring-2 ring-primary bg-primary/5' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Overlay for replacing data */}
        <div className={`absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity duration-200 pointer-events-none ${isDragOver ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-full font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Replace Data
          </div>
        </div>

        {renderChart()}
      </div>
    )
  }

  // Placeholder State
  return (
    <div 
      className={`w-full h-full min-h-[200px] rounded-xl border-2 border-solid transition-all duration-300 flex flex-col items-center justify-center p-6 text-center select-none border-ring/80
        ${isDragOver 
          ? 'border-primary bg-primary/5 scale-[0.99] shadow-inner' 
          : 'border-border/30 bg-card/10 hover:border-border/60 hover:bg-card/20'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`p-4 rounded-full mb-3 transition-colors duration-300 ${isDragOver ? 'bg-primary/20 text-primary' : 'bg-background/40 text-muted-foreground/40 group-hover:text-muted-foreground'}`}>
      
        <span className="text-xl font-medium tracking-tight">
            {type.charAt(0).toUpperCase() + type.slice(1)} Chart
        </span>
      </div>
      <h3 className={`text-sm font-medium transition-colors duration-300 ${isDragOver ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
        Ready for Data
      </h3>
      <p className="text-xs text-muted-foreground/50 mt-1 max-w-[150px]">
        Drop a data source here to visualize it
      </p>
    </div>
  )
}

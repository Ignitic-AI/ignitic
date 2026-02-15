"use client"

import { Database, TrendingUp, Users, DollarSign, Activity } from "lucide-react"

export const AVAILABLE_DATA = [
  { id: "agent_runs", label: "Agent Runs", icon: <Activity className="w-4 h-4" /> },
  { id: "revenue", label: "Revenue", icon: <DollarSign className="w-4 h-4" /> },
  { id: "traffic", label: "Traffic", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "users", label: "Active Users", icon: <Users className="w-4 h-4" /> },
  { id: "tokens", label: "Token Usage", icon: <Database className="w-4 h-4" /> },
]

export function DataSidebar() {
  const handleDragStart = (e: React.DragEvent, dataId: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "data-source", id: dataId }))
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <aside className="w-64 border-l border-border bg-white/5 backdrop-blur-xl h-vh sticky overflow-y-auto scrollbar-hide p-4 hidden md:block">
      <h2 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider px-2">Data Sources</h2>
      <div className="space-y-3">
        {AVAILABLE_DATA.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            className="group flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/40 hover:bg-card/80 transition-all duration-300 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/20"
          >
            <div className="p-2 rounded-lg bg-gray-400 dark:bg-background/50 text-foreground group-hover:text-primary transition-colors">
              {item.icon}
            </div>
            <span className="font-medium text-sm text-foreground/80 group-hover:text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

"use client"

import { useState, useEffect } from "react"
import { DynamicChart } from "./DynamicChart"
import { toast } from "sonner"
import { PieChart, BarChart, LineChart, Activity, X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ChartDropZoneProps {
  layout: Record<string, string | null>
  slotCount: number
  chartDataMap: Record<string, string | null>
  chartTypeMap: Record<string, string | null>
  onDropData: (chartId: string, dataId: string) => void
  onChartDrop: (slotId: string, chartType: string) => void
  onRemoveChart: (slotId: string) => void
  onSave: () => void
}

export function ChartDropZone({ layout, slotCount, chartDataMap, chartTypeMap, onDropData, onChartDrop, onRemoveChart, onSave }: ChartDropZoneProps) {
  const slots = Array.from({ length: slotCount }, (_, i) => `slot-${i + 2}`)
  const [templateName, setTemplateName] = useState("Untitled Template")
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [pendingRemoveSlotId, setPendingRemoveSlotId] = useState<string | null>(null)

  //MAKE SURE TO CLEAR LOCAL STORAGE WHEN USER CLICKS SAVE
  useEffect(() => {
    const savedName = localStorage.getItem("draft_template_name")
    if (savedName) {
      setTemplateName(savedName)
    }
  }, [])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setTemplateName(newName)
    localStorage.setItem("draft_template_name", newName)
  }

  const handleDrop = (e: React.DragEvent, slotId: string) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"))
      
      if (data.type === "chart-type") {
        onChartDrop(slotId, data.chartType)
      } else if (data.type === "data-source") {
        toast.error("Please add a chart first before adding data.")
      }
    } catch (err) {
      // Ignore invalid JSON or other drops
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleRemoveClick = (slotId: string, hasData: boolean) => {
    if (hasData) {
      setPendingRemoveSlotId(slotId)
      setRemoveDialogOpen(true)
    } else {
      onRemoveChart(slotId)
    }
  }

  const confirmRemove = () => {
    if (pendingRemoveSlotId) {
      onRemoveChart(pendingRemoveSlotId)
      setPendingRemoveSlotId(null)
    }
    setRemoveDialogOpen(false)
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto h-[calc(100vh-4rem)] scrollbar-hide">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <input
            value={templateName}
            onChange={handleNameChange}
            className={`text-3xl tracking-tight font-generalSans bg-transparent border-none focus:outline-none w-full placeholder:text-muted-foreground/50 ${
              templateName && templateName !== "Untitled Template"
                ? "font-semibold text-text-lm dark:text-text"
                : "font-light text-muted-foreground"
            }`}
            placeholder="Template Name"
          />
          <Button 
            variant="default"
            size="sm"
            onClick={onSave}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {slots.map((slotId) => {
            const rawItemId = layout[slotId]
            // itemId is now unique (e.g., "bar-123")
            // specificChartType is the basic type (e.g., "bar")
            
            // FIX: If the item ID is a placeholder (swapped empty slot), treat it as null/empty
            const isOccupied = rawItemId && !rawItemId.toString().startsWith("placeholder-")
            const itemId = isOccupied ? rawItemId : null

            const specificChartType = itemId ? chartTypeMap[itemId] : null

            return (
              <div
                key={slotId}
                data-swapy-slot={slotId}
                className="dashboard-mode aspect-video rounded-xl border-2 border-dashed border-border/30 bg-card/10 flex items-center justify-center transition-colors hover:border-border/60 hover:bg-card/20 relative"
                onDragOver={!itemId ? handleDragOver : undefined}
                onDrop={!itemId ? (e) => handleDrop(e, slotId) : undefined}
              >
                {itemId ? (
                  <div data-swapy-item={itemId} 
                  style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
                  className="w-full h-full relative group/chart">
                    {/* Sidebar View: Minimal Icon/Text */}
                    {!chartDataMap[itemId] && (
                    <div className="sidebar-content w-full p-3 font-medium text-sm text-foreground flex items-center gap-2">
                       {specificChartType === 'bar' && <BarChart className="w-4 h-4" />}
                       {specificChartType === 'line' && <LineChart className="w-4 h-4" />}
                       {specificChartType === 'pie' && <PieChart className="w-4 h-4" />}
                       {specificChartType === 'area' && <Activity className="w-4 h-4" />}
                       <span className="capitalize">{specificChartType} Chart</span>
                       <X 
                         className="w-4 h-4 ml-auto text-muted-foreground hover:text-red-400 cursor-pointer transition-colors" 
                         onClick={(e) => {
                           e.stopPropagation()
                           handleRemoveClick(slotId, false)
                         }}
                       />
                    </div>
                    )}

                    {/* Remove button overlay for charts with data */}
                    {chartDataMap[itemId] && (
                      <div className="absolute top-2 right-2 z-20 opacity-0 group-hover/chart:opacity-100 transition-opacity duration-200">
                        <button
                          className="p-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-400/50 cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveClick(slotId, true)
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    {/* Dashboard View: Dynamic Chart Component */}
                    <div className="dashboard-content w-full h-full">
                      <DynamicChart 
                        type={specificChartType || 'bar'} 
                        dataId={chartDataMap[itemId] || null} 
                        onDropData={(dataId) => onDropData(itemId, dataId)} 
                      />
                    </div>
                  </div>
                ) : (
                  <div data-swapy-item={`placeholder-${slotId}`} className="w-full h-full pointer-events-none" style={{ width: '100%', height: '100%', display: 'flex' }}>
                    <div 
                      className="dashboard-content w-full h-full flex flex-col items-center justify-center text-muted-foreground/70 font-medium select-none pointer-events-auto"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.stopPropagation()
                        handleDrop(e, slotId)
                      }}
                    >
                      <span className="text-lg">Drop Chart Types Here</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirmation dialog for removing charts with data */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent className="font-generalSans">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-generalSans">Remove Chart</AlertDialogTitle>
            <AlertDialogDescription className="font-generalSans">
              This chart has data attached to it. Are you sure you want to remove it? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRemoveSlotId(null)} className="font-generalSans">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-generalSans">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

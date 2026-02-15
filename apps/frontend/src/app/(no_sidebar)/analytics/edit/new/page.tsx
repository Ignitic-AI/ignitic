"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createSwapy } from "swapy"
import { DraggableChartSidebar } from "@/components/analytics/DraggableChartSidebar"
import { ChartDropZone } from "@/components/analytics/ChartDropZone"
import { DataSidebar } from "@/components/analytics/DataSidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/ThemeToggle"
import ProfileIcon  from "@/components/ProfileIcon"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function AnalyticsTemplatePage({ params }: { params: { id: string } }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slotCount, setSlotCount] = useState(1)
  const [layout, setLayout] = useState<Record<string, string | null>>({})
  const [chartDataMap, setChartDataMap] = useState<Record<string, string | null>>({})
  const [chartTypeMap, setChartTypeMap] = useState<Record<string, string | null>>({})
  const layoutRef = useRef<Record<string, string | null>>({})

  const router = useRouter()

  const handleSwap = useCallback((event: any) => {
    // Just update the ref during drag to avoid re-renders interfering with Swapy
    if (event?.data?.object) {
      layoutRef.current = event.data.object
    }
  }, [])
    
  // --- Persistence Logic ---
  const STORAGE_KEY = "analytics-dashboard-state"

  // 1. Load from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.layout) {
            setLayout(parsed.layout)
            layoutRef.current = parsed.layout
            
            // Recalculate slotCount based on restored layout
            const occupiedCount = Object.values(parsed.layout).filter((id) => {
                return id && !id.toString().startsWith("placeholder-")
            }).length
            setSlotCount(Math.max(1, occupiedCount + 1))
        }
        if (parsed.chartDataMap) setChartDataMap(parsed.chartDataMap)
        if (parsed.chartTypeMap) setChartTypeMap(parsed.chartTypeMap)
      }
    } catch (err) {
      console.error("Failed to load dashboard state", err)
    }
  }, [])

  // 2. Save to LocalStorage on change
  useEffect(() => {
    const stateToSave = {
        layout,
        chartDataMap,
        chartTypeMap
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
  }, [layout, chartDataMap, chartTypeMap])

  const handleDataDrop = (chartId: string, dataId: string) => {
    setChartDataMap((prev) => ({
      ...prev,
      [chartId]: dataId
    }))
  }

  const handleChartDrop = (slotId: string, chartType: string) => {
    const newChartId = `${chartType}-${Date.now()}`
    
    setChartTypeMap((prev) => ({
      ...prev,
      [newChartId]: chartType
    }))

    // Update layout to place the new chart in the slot
    // We need to update both state and ref to stay in sync
    const newLayout = { ...layoutRef.current, [slotId]: newChartId }
    layoutRef.current = newLayout
    setLayout(newLayout)

    // Immediate N+1 Calculation
    const occupiedCount = Object.values(newLayout).filter((id) => {
        return id && !id.toString().startsWith("placeholder-")
    }).length
    setSlotCount(Math.max(1, occupiedCount + 1))
  }

  const handleRemoveChart = (slotId: string) => {
    const newLayout = { ...layoutRef.current }
    delete newLayout[slotId]
    layoutRef.current = newLayout
    setLayout(newLayout)

    const occupiedCount = Object.values(newLayout).filter((id) => {
        return id && !id.toString().startsWith("placeholder-")
    }).length
    setSlotCount(Math.max(1, occupiedCount + 1))
  }

  useEffect(() => {
    // Safety check just in case
    if (!containerRef.current) return

    const swapy = createSwapy(containerRef.current, {
      animation: "dynamic",
    })

    swapy.onSwap(handleSwap)

    const handlePointerUp = (e: Event) => {
      // Capture the final state after drop
      // We use a small timeout to let Swapy finish its internal updates if needed
      setTimeout(() => {
        const currentLayout = layoutRef.current
        
        // Count occupied slots
        // Items are occupied if they map to a value that is NOT a placeholder AND not null
        const occupiedCount = Object.values(currentLayout).filter((id) => {
             return id && !id.toString().startsWith("placeholder-")
        }).length

        // Always N+1 slots
        // If we have 0 occupied, slotCount should be 1.
        // If we have 1 occupied, slotCount should be 2.
        const newSlotCount = Math.max(1, occupiedCount + 1)

        if (newSlotCount !== slotCount) {
             setSlotCount(newSlotCount)
        }
        
        // Use functional update to ensure we don't lose state
        setLayout(currentLayout)
      }, 50)
    }

    // Attach listener to capture drop anywhere
    document.addEventListener("pointerup", handlePointerUp)

    return () => {
      swapy.destroy()
      document.removeEventListener("pointerup", handlePointerUp)
    }
  }, [slotCount, handleSwap]) // Re-init when slotCount changes to register new slots

  const handleSave = () => {
    // Clear local storage for both layout and template name
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem("draft_template_name")
    
    // Optional: You might want to also reset the state here if you want the UI to reflect the "saved/cleared" state immediately
    // For now, we just clear the storage so it doesn't persist on reload
    
    toast.success("Template saved successfully", {
      description: "Draft cleared from local storage."
    })
  }

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b justify-between dark:bg-bg-dark bg-bg-dark-lm px-4">
        {/* Left Side: Back Button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-text-lm dark:text-text hover:bg-transparent rounded-lg bg-gray-200 dark:bg-highlight border-1 overflow-hidden" asChild>
            <motion.button
              whileHover="hover"
              initial="initial"
              className="flex items-center gap-2"
              onClick={() => router.push('/analytics')}
            >
              <motion.div
                variants={{ 
                  initial: { x: 0 },
                  hover: { x: -3 } 
                }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="flex items-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.div>
              <motion.span 
                variants={{ 
                  initial: { x: 0 },
                  hover: { x: 3 } 
                }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="font-generalSans font-medium text-xl"
              >
                Back
              </motion.span>
            </motion.button>
          </Button>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-3">
          <ModeToggle />
          <ProfileIcon />
        </div>
      </header>

      {/* Page content */}
      <div className="flex flex-1 flex-col gap-4 dark:bg-bg-dark bg-bg-dark-lm overflow-hidden">
        <div ref={containerRef} className="flex flex-1 bg-background text-foreground font-generalSans overflow-hidden">
          <DraggableChartSidebar />
          <ChartDropZone
            layout={layout}
            slotCount={slotCount}
            chartDataMap={chartDataMap}
            chartTypeMap={chartTypeMap}
            onDropData={handleDataDrop}
            onChartDrop={handleChartDrop}
            onRemoveChart={handleRemoveChart}
            onSave={handleSave}
          />

          <DataSidebar />
        </div>
      </div>
    </SidebarInset>
  )
}

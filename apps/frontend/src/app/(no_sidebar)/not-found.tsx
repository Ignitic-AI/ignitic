"use client"

import {useState, useEffect} from "react"
import { TreePalm, Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function NotFound() {
  const [isAnimated, setIsAnimated] = useState(false)

  useEffect(() => {
    setIsAnimated(true)
  }, [])

  return (
    <div className="min-h-screen bg-bg flex text-text items-center justify-center p-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Animated Icon */}
        <div className="mb-4 relative">
          <div
            className={`
              inline-flex items-center justify-center w-32 h-32 bg-emerald-100 rounded-full
              transition-all duration-1000 ease-out
              ${isAnimated ? "scale-100 rotate-0" : "scale-0 rotate-180"}
            `}
          >
            <TreePalm
              className={`
                w-16 h-16 text-emerald-400 transition-all duration-1000 ease-out delay-300
                ${isAnimated ? "rotate-0" : "rotate-180"}
              `}
            />
          </div>

          
        </div>

        

        {/* Quirky Message */}
        <div
          className={`
            mb-8 transition-all duration-1000 ease-out delay-400
            ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
          `}
        >
          <h1 className="text-3xl font-bold text-text mb-2">Page Not Found</h1>
            <p className="text-lg text-text-muted leading-relaxed max-w-md mx-auto font-generalSans">
            Looks like this page decided to take a vacation without telling us 🗺️
          </p>
        </div>

        {/* Action Buttons */}
        <div
          className={`
            flex flex-col sm:flex-row gap-4 justify-center items-center
            transition-all duration-1000 ease-out delay-600
            ${isAnimated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
          `}
        >
          <Link href="/">
            <Button className="bg-primary hover:bg-success hover:text-md text-text px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 hover:scale-105 font-generalSans">
              <Home className="w-4 h-4" />
              Take Me Home
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="border-border text-primary hover:bg-gray-500 bg-text-muted px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 hover:scale-105 font-generalSans"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>

        

        
      </div>
    </div>
  )
}

"use client"

import {useState, useEffect} from "react"
import { Compass, Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function NotFound() {
  const [isAnimated, setIsAnimated] = useState(false)

  useEffect(() => {
    setIsAnimated(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Animated Icon */}
        <div className="mb-8 relative">
          <div
            className={`
              inline-flex items-center justify-center w-32 h-32 bg-emerald-100 rounded-full mb-6
              transition-all duration-1000 ease-out
              ${isAnimated ? "scale-100 rotate-0" : "scale-0 rotate-180"}
            `}
          >
            <Compass
              className={`
                w-16 h-16 text-emerald-600 transition-all duration-1000 ease-out delay-300
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Page Not Found</h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-md mx-auto font-generalSans">
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
            <Button className="bg-bg hover:bg-emerald-700 text-text px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 hover:scale-105 font-generalSans">
              <Home className="w-4 h-4" />
              Take Me Home
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="border-border text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all duration-200 hover:scale-105 font-generalSans"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>

        

        
      </div>
    </div>
  )
}

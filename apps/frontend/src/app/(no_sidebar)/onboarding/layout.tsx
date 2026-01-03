"use client"

import React, { useRef } from "react"
import Image from "next/image"
import logo from "../../../../public/white-logo.png"
import { useParams } from "next/navigation"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ onboarding: string[] }>()
  const step = params.onboarding?.[0] || '1';
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Progress Bar Animation
  useGSAP(() => {
      const targetWidth = ((Number(step) - 1) / 3) * 100;
      gsap.to(progressBarRef.current, {
          width: `${targetWidth}%`,
          duration: 0.5,
          ease: "power2.out"
      });
  }, [step]);

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col font-generalSans text-text">
       {/*Header */}
       <header className="bg-bg border-b border-border-muted px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-enter justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-bg-dark rounded-md flex items-center justify-center mb-6">
                  <Image
      src={logo}
      alt="Logo Icon"
      width={18}
      height={18}
      className="icon-class rounded"
    />
                </div>
                <div className="text-2xl font-generalSans font-bold text-text mb-6">Ignitic AI</div>
          </div>
        </div>
      </header>

       {/* Custom Glowing Progress Bar */}
       <div className="bg-black pt-10 z-10">
            <div className="max-w-4xl mx-auto px-6 relative">
                 {/* Flex Container for perfect vertical centering */}
                 <div className="relative flex items-center justify-between w-full h-2">
                    {/* Line Background */}
                    <div className="absolute left-0 right-0 h-0.5 bg-white/10 rounded-full top-1/2 -translate-y-1/2" />
                    
                    {/* Active Line */}
                    <div
                        ref={progressBarRef}
                        className="absolute left-0 h-0.5 bg-success rounded-full shadow-[0_0_10px_#22c55e] top-1/2 -translate-y-1/2 z-0"
                        style={{ width: '0%' }}
                    />

                    {/* Dots */}
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`relative z-10 w-2 h-2 rounded-full transition-colors duration-300 ${
                                Number(step) >= i + 1 ? "bg-success shadow-[0_0_8px_#22c55e]" : "bg-white/20"
                            }`}
                        />
                    ))}
                 </div>
            </div>
          </div>

      {children}
    </div>
  )
}

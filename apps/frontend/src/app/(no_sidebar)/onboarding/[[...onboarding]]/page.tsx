"use client"

import { useRouter, useParams } from "next/navigation"
import Step1 from "@/components/Step1"
import Step2 from "@/components/Step2"
import Step3 from "@/components/Step3"
import Step4 from "@/components/Step4"
import React, { useRef, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

const STEP_TITLES = [
  "Account Setup",
  "Personal Details",
  "Preferences",
  "Review & Complete"
];

export default function OnBoardingPage() {
  const router = useRouter()
  const params = useParams<{ onboarding: string[] }>()
  const step = params.onboarding?.[0] || '1';
  const currentStepIndex = Number(step) - 1;
  const isLastStep = step === '4';

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const [direction, setDirection] = useState(1);
  const { contextSafe } = useGSAP({ scope: containerRef });

  // 1. VERTICAL Progress Bar Animation
  useGSAP(() => {
      // Calculate height percentage based on step (0%, 33%, 66%, 100%)
      const targetHeight = (currentStepIndex / 3) * 100;
      
      gsap.to(progressBarRef.current, {
          height: `${targetHeight}%`,
          duration: 0.5,
          ease: "power2.out"
      });
  }, [step]);

  // 2. Step Transition Animation
  useGSAP(() => {
    gsap.fromTo(
      containerRef.current,
      { y: direction * 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
    );
  }, [step]);

  // Navigation Logic
  const animateStep = contextSafe((newStep: string, dir: number) => {
    setDirection(dir);
    gsap.to(containerRef.current, {
      y: -dir * 20,
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        if (newStep === "/") {
            router.push("/");
        } else {
            router.push(`/onboarding/${newStep}`);
        }
      },
    });
  });

  const handleNext = () => {
    if (isLastStep) {
      animateStep("/", 1);
    } else {
      animateStep(String(Number(step) + 1), 1);
    }
  };

  const handleBack = () => {
    if (step !== '1') {
      animateStep(String(Number(step) - 1), -1);
    }
  };

  return (
      <main className="flex-1 flex flex-col w-full relative pb-24"> {/* pb-24 ensures content isn't hidden behind sticky footer */}
        
        <div className="max-w-7xl mx-auto w-full px-6 py-12 grid grid-cols-12 gap-12 flex-1">
            
            {/* SECTION 1: Content (3/4 Width -> col-span-9) */}
            <div className="col-span-12 lg:col-span-9">
                <div ref={containerRef} className="min-h-[400px]">
                    {step === '1' && <Step1 />}
                    {step === '2' && <Step2 />}
                    {step === '3' && <Step3 />}
                    {step === '4' && <Step4 />}
                </div>
            </div>

            {/* SECTION 2: Vertical Progress Bar (1/4 Width -> col-span-3) */}
            {/* We hide this on small mobile screens (hidden) and show on large (lg:block) */}
            <div className="hidden lg:col-span-3 lg:block pl-8 border-l border-white/5">
                <div className="sticky top-12">
                  <h3 className="text-xl font-semibold font-generalSans mb-8 text-white">Progress Bar</h3>
                  
                  <div className="relative h-[300px] flex">
                      {/* Vertical Line Container */}
                      <div className="relative w-0.5 h-full bg-white/10 rounded-full mr-8">
                          {/* Active Vertical Line */}
                          <div
                              ref={progressBarRef}
                              className="absolute top-0 left-0 w-full bg-success rounded-full shadow-[0_0_10px_#22c55e]"
                              style={{ height: '0%' }}
                          />
                      </div>

                      {/* Steps & Dots Container */}
                      <div className="absolute top-0 left-[-3.5px] h-full flex flex-col justify-between w-full">
                          {STEP_TITLES.map((title, i) => (
                              <div key={i} className="flex items-center group">
                                  {/* Dot */}
                                  <div
                                      className={`relative z-10 w-2.5 h-2.5 rounded-full transition-all duration-300 border-2 ${
                                          currentStepIndex >= i 
                                            ? "bg-success border-success shadow-[0_0_8px_#22c55e] scale-125" 
                                            : "bg-bg-dark border-white/20"
                                      }`}
                                  />
                                  
                                  {/* Heading/Label */}
                                  <div className={`ml-6 transition-colors font-generalSans duration-100 ${
                                      currentStepIndex === i 
                                        ? "text-white font-medium" 
                                        : currentStepIndex > i 
                                          ? "text-success/80"
                                          : "text-text-muted"
                                  }`}>
                                      
                                      {title}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
                </div>
            </div>

        </div>

        {/* SECTION 3: Sticky Bottom Bar (Full Width) */}
        <div className="fixed bottom-0 left-0 w-full bg-bg border-t border-border-muted px-6 py-6 z-50 shadow-2xl shadow-black/50">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Button
                    variant="outline"
                    disabled={step === '1'}
                    className="flex items-center gap-2 font-generalSans bg-bg-light text-text-muted border-border-muted hover:bg-highlight hover:text-text transition-colors"
                    onClick={handleBack}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>

                <div className="flex items-center gap-4">
                  
                  <Button
                      onClick={handleNext}
                      className="flex items-center gap-2 bg-success text-text font-semibold hover:bg-success/80 transition-all font-generalSans shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                  >
                      {isLastStep ? "Complete Setup" : "Continue"}
                      <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
            </div>
        </div>

      </main>
  )
}
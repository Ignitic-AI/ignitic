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

export default function OnBoardingPage() {

  const router = useRouter()
  const params = useParams<{ onboarding: string[] }>()
  const step = params.onboarding?.[0] || '1';
  const isLastStep = step === '4';

  const containerRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(1);

  const { contextSafe } = useGSAP({ scope: containerRef });

  // Step Transition Animation
  useGSAP(() => {
    gsap.fromTo(
      containerRef.current,
      { x: direction * 20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
    );
  }, [step]);

  const animateStep = contextSafe((newStep: string, dir: number) => {
    setDirection(dir);
    // Exit animation
    gsap.to(containerRef.current, {
      x: -dir * 20,
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
      /*Main Content */
      <main className="flex-1 flex flex-col">
        <div className="max-w-4xl mx-auto w-full px-6  flex-1 relative">
          
      <div ref={containerRef} className="mt-12">
        {step === '1' && <Step1 />}
        {step === '2' && <Step2 />}
        {step === '3' && <Step3 />}
        {step === '4' && <Step4 />}
      </div>
        </div>
      

      {/*Bottom Section with Navigation */}
      <div className="bg-bg border-t border-border-muted px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <Button
    variant="outline"
    disabled={step === '1'}
    className="flex items-center gap-2 bg-bg-light text-text-muted border-border-muted hover:bg-highlight hover:text-text"
    onClick={handleBack}
  >
    <ArrowLeft className="w-4 h-4" />
    Back
  </Button>

            <Button
    onClick={handleNext}
    className="flex items-center gap-2 bg-success text-text hover:bg-success/80"
  >
    {isLastStep ? "Done" : "Next"}
    <ArrowRight className="w-4 h-4" />
  </Button>
          </div>
        </div>
      </div>
      </main>
  )
}
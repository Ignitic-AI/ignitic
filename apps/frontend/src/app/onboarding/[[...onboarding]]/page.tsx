"use client"

import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import logo from "../../../../public/white-logo.png"
import Step1 from "@/components/Step1"
import Step2 from "@/components/Step2"
import Step3 from "@/components/Step3"
import Step4 from "@/components/Step4"
import React from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export default function OnBoardingPage() {

  const router = useRouter()
  const params = useParams<{ onboarding: string[] }>()
  const step = params.onboarding?.[0] || '1';
  const isLastStep = step === '4';

  const handleNext = () => {
    if (isLastStep) {
      router.push("/");
    } else {
      router.push(`/onboarding/${Number(step) + 1}`);
    }
  };

  const handleBack = () => {
    if (step !== '1') {
      router.push(`/onboarding/${Number(step) - 1}`);
    }
  };

  const progress = (Number(step) / 4) * 100;


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-generalSans">
      {/*Header */}
      <header className="bg-white border-b border-border px-6 py-4">
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
                <div className="text-2xl font-bold text-bg mb-6">Ignitic AI</div>
          </div>
        </div>
      </header>


      {/*Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="max-w-4xl mx-auto w-full px-6 py-8 flex-1 relative">
          {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0  bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <Progress value={progress} className="h-2 bg-gray-200 [&>div]:bg-emerald-700" />
        </div>
      </div>
      {step === '1' && <Step1 />}
      {step === '2' && <Step2 />}
      {step === '3' && <Step3 />}
      {step === '4' && <Step4 />}
        </div>
      

      {/*Bottom Section with Progress and Navigation */}
      <div className="bg-white border-t border-border px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {/*Progress Bar */}
          
          {/*Navigation Button */}
          <div className="flex justify-between items-center">
            <Button
    variant="outline"
    disabled={step === '1'}
    className="flex items-center gap-2 bg-text text-gray-500 hover:bg-bg hover:text-text"
    onClick={handleBack}
  >
    <ArrowLeft className="w-4 h-4" />
    Back
  </Button>

            <Button
    onClick={handleNext}
    className="flex items-center gap-2 bg-success hover:bg-emerald-700"
  >
    {isLastStep ? "Done" : "Next"}
    <ArrowRight className="w-4 h-4" />
  </Button>
          </div>
        </div>
      </div>
      </main>
    </div>
  )
}
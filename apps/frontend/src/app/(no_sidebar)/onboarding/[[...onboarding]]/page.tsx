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
import { useOnboardingStore } from "@/app/_store/useOnboardingStore"
import { step1Schema, step2Schema } from "@/lib/validations"
import { toast } from "sonner"

const STEP_TITLES = [
  "Account Setup",
  "Organization Details",
  "Invite Members",
  "Preferences"
];

// Track previous step index outside component to persist across remounts
let previousStepIndex = 0;

export default function OnBoardingPage() {
  const router = useRouter()
  const params = useParams<{ onboarding: string[] }>()
  const step = params.onboarding?.[0] || '1';
  const currentStepIndex = Number(step) - 1;
  const isLastStep = step === '4';
  const { submitOrganization, completeOnboarding, isSubmitting, formData, addMembers } = useOnboardingStore()

  // Determine button text
  const getButtonText = () => {
    if (isSubmitting) {
      if (isLastStep) return "Saving...";
      if (step === '2' && formData.isOrg) return "Creating...";
      return "Please wait...";
    }
    if (step === '2' && formData.isOrg) return "Create Organization";
    if (isLastStep) return "Complete Setup";
    return "Continue";
  };

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const [direction, setDirection] = useState(1);
  const { contextSafe } = useGSAP({ scope: containerRef });

  // Shake animation for validation errors
  const triggerShake = () => {
    if (containerRef.current) {
      containerRef.current.classList.add('shake');
      setTimeout(() => {
        containerRef.current?.classList.remove('shake');
      }, 500);
    }
  };

  // 1. VERTICAL Progress Bar Animation
  useGSAP(() => {
      // Calculate height percentage based on step (0%, 33%, 66%, 100%)
      const startHeight = (previousStepIndex / 3) * 100;
      const targetHeight = (currentStepIndex / 3) * 100;
      
      gsap.fromTo(progressBarRef.current, 
          { height: `${startHeight}%` },
          {
              height: `${targetHeight}%`,
              duration: 0.5,
              ease: "power3.out",
              onComplete: () => {
                  previousStepIndex = currentStepIndex;
              }
          }
      );
      
      // Update immediately for next render if onComplete is too late
      previousStepIndex = currentStepIndex;
  }, [step]);

  // 2. Step Transition Animation
  useGSAP(() => {
    gsap.fromTo(
      containerRef.current,
      { y: direction * 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
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
        } else if (newStep === "/organization") {
            router.push("/");
        } else {
            router.push(`/onboarding/${newStep}`);
        }
      },
    });
  });

  const handleNext = async () => {
    const { formData } = useOnboardingStore.getState();
    
    // Step 1: Validate and check if user has org
    if (step === '1') {
      const validation = step1Schema.safeParse(formData);
      
      if (!validation.success) {
        const errorMessage = validation.error.issues[0]?.message || "Please fill in all required fields";
        toast.error(errorMessage);
        triggerShake();
        return;
      }
      
      if (formData.isOrg) {
        // Has org -> go to Step 2
        animateStep('2', 1);
      } else {
        // No org -> skip to Step 4
        animateStep('4', 1);
      }
      return;
    }
    
    // Step 2: Validate and submit API if user has org
    if (step === '2' && formData.isOrg) {
      const validation = step2Schema.safeParse(formData);
      
      if (!validation.success) {
        const errorMessage = validation.error.issues[0]?.message || "Please fill in all required fields";
        toast.error(errorMessage);
        triggerShake();
        return;
      }
      
      const success = await submitOrganization();
      if (success) {
        toast.success("Organization created successfully!");
        // Navigate to Step 3 after successful API submission
        animateStep('3', 1);
      } else {
        toast.error("Failed to create organization. Please try again.");
      }
      return;
    }

    // Step 3: Handle email input
    if (step === '3') {
        const emailInput = formData.emailInput || "";
        const invitedEmails = formData.invitedEmails || [];

        if (emailInput.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.trim())) {
                toast.error("Please enter a valid email address");
                triggerShake();
                return;
            }
            if (invitedEmails.includes(emailInput.trim().toLowerCase())) {
                toast.error("This email has already been added");
                triggerShake();
                return;
            }

            useOnboardingStore.getState().updateStep3({
                invitedEmails: [...invitedEmails, emailInput.trim().toLowerCase()],
                emailInput: ""
            });
        }
        
        await addMembers();
        animateStep('4', 1);
        return;
    }
    
    // Step 4: persist preferences then finish
    if (isLastStep) {
      const ok = await completeOnboarding();
      if (!ok) {
        toast.error(useOnboardingStore.getState().error ?? "Failed to save preferences.");
        triggerShake();
        return;
      }
      toast.success("Setup complete!");
      useOnboardingStore.getState().resetForm();
      animateStep("/organization", 1);
    } else {
      animateStep(String(Number(step) + 1), 1);
    }
  };

  const handleSkip = () => {
    if (step === '1' || step === '2' || step === '3') {
      animateStep('4', 1);
    } else if (step === '4') {
      void (async () => {
        await completeOnboarding();
        useOnboardingStore.getState().resetForm();
        animateStep('/', 1);
      })();
    }
  };

  const handleBack = () => {
    const { formData } = useOnboardingStore.getState();
    
    if (step === '1') return;

    // Step 4: conditional back navigation
    if (step === '4') {
      if (!formData.isOrg) {
        animateStep('1', -1); // No org: 4 → 1
      } else {
        animateStep('3', -1); // Has org: 4 → 3
      }
      return;
    }

    // Step 3: conditional back navigation
    if (step === '3') {
      if (!formData.isOrg) {
        animateStep('1', -1); // No org: 3 → 1 (defensive, shouldn't happen)
      } else {
        animateStep('2', -1); // Has org: 3 → 2
      }
      return;
    }

    // Default: previous step (e.g., 2 → 1)
    animateStep(String(Number(step) - 1), -1);
  };

  // Validation Logic for Button State
  const isStepValid = () => {
    if (step === '1') {
      // Step 1: If isOrg is true, orgName is required. Otherwise valid.
      if (formData.isOrg) {
        return formData.orgName.trim().length > 0;
      }
      return true;
    }
    
    if (step === '2') {
      // Step 2: sizeOfOrg, yourRole, country are required. whereYouHearUs is optional.
      return (
        !!formData.sizeOfOrg && 
        formData.yourRole.trim().length > 0 && 
        !!formData.country
      );
    }

    if (step === '3') {
      const invitedEmails = formData.invitedEmails || []
      const emailInput = formData.emailInput || ""
      return invitedEmails.length > 0 || emailInput.trim().length > 0
    }
    
    if (step === '4') {
        const automations = formData.automations || []
        return automations.length > 0
    }

    return true; // Default to valid for other steps
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
            <div className="hidden lg:col-span-3 lg:flex flex-col justify-between relative min-h-[600px]">
                <div className="sticky top-12 pl-8 border-l border-white/5">
                  <h3 className="text-xl font-semibold font-generalSans mb-8 text-white">Progress Bar</h3>
                  
                  <div className="relative h-[300px] flex">
                      {/* Vertical Line Container */}
                      <div className="relative w-0.5 h-[calc(100%-1.5rem)] my-auto bg-white/10 rounded-full mr-8">
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
                    disabled={step === '1' || (step === '3' && formData.isOrg)}
                    className="flex items-center gap-2 font-generalSans bg-bg-light text-text-muted border-border-muted hover:bg-highlight hover:text-text transition-colors"
                    onClick={handleBack}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>

                <div className="flex items-center gap-4">

                     <button 
                        onClick={handleSkip}
                        className="flex items-center gap-2 text-text-muted hover:text-white transition-colors font-generalSans"
                     >
                        Skip for now
                        <ArrowRight className="w-4 h-4" />
                     </button>

                  
                  <Button
                      onClick={handleNext}
                      disabled={isSubmitting || !isStepValid()}
                      className="flex items-center gap-2 bg-success text-text font-semibold hover:bg-success/80 transition-all font-generalSans shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {getButtonText()}
                      <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
            </div>
        </div>

      </main>
  )
}
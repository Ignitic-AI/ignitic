"use client"
import * as React from "react"
import {   Plus, X, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOnboardingStore } from "@/app/_store/useOnboardingStore"


const Step3 = () => {
  const [emailError, setEmailError] = React.useState("")
  const { formData, updateStep3 } = useOnboardingStore()
  
  const invitedEmails = formData.invitedEmails || []
  const emailInput = formData.emailInput || "" 

  const setEmailInput = (value: string) => updateStep3({ emailInput: value })

  

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleAddEmail = () => {
    const trimmedEmail = emailInput.trim().toLowerCase()

    if (!trimmedEmail) {
      setEmailError("Please enter an email address")
      return
    }

    if (!validateEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address")
      return
    }

    if (invitedEmails.includes(trimmedEmail)) {
      setEmailError("This email has already been added")
      return
    }

    updateStep3({ invitedEmails: [...invitedEmails, trimmedEmail] })
    setEmailInput("")
    setEmailError("")
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    updateStep3({ invitedEmails: invitedEmails.filter((email) => email !== emailToRemove) })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddEmail()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailInput(e.target.value)
    if (emailError) {
      setEmailError("")
    }
  }


  return (
    <div className="font-generalSans">
    <div className="text-center mb-12">
            <h1 className="text-4xl font-generalSans font-semibold text-text mb-4">Invite Members</h1>
            <p className="text-lg text-text-muted">Add your team members to collaborate on Ignitic AI</p>
          </div>

          {/* Email Input Section */}
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Input
                  type="email"
                  placeholder="Enter Email To Invite"
                  value={emailInput}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 ${
                    emailError ? "border-danger focus:border-danger" : "border-border-muted focus:border-primary"
                  }`}
                />
                {emailError && <p className="absolute -bottom-6 left-0 text-sm text-red-600">{emailError}</p>}
              </div>

              {/* Contact Book Icon */}
              

              <Button
                onClick={handleAddEmail}
                className="bg-success hover:bg-success/80 w-9 h-9 rounded-full flex items-center justify-center"
              >
                <Plus className="w-7 h-7" />
              </Button>
            </div>

            {/* Invited Emails List */}
            {invitedEmails.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-text mb-4">Invited Members ({invitedEmails.length})</h3>
                <div className="space-y-2">
                  {invitedEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-bg-light p-4 rounded-lg border border-border-muted"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-bg rounded-full flex items-center justify-center">
                          <Mail className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-text">{email}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-text-muted hover:text-danger hover:bg-danger/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skip Option */}
            {invitedEmails.length === 0 && (
              <div className="text-center mt-8">
                <p className="text-text-muted mb-4">You can always invite team members later</p>
              </div>
            )}
          </div>
        </div>
  )
}

export default Step3
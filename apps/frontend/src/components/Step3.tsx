"use client"
import * as React from "react"
import {   Plus, X, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"


const Step3 = () => {
  const [emailInput, setEmailInput] = React.useState("")
  const [invitedEmails, setInvitedEmails] = React.useState<string[]>([])
  const [emailError, setEmailError] = React.useState("")

  

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

    setInvitedEmails([...invitedEmails, trimmedEmail])
    setEmailInput("")
    setEmailError("")
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    setInvitedEmails(invitedEmails.filter((email) => email !== emailToRemove))
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
    <>
    <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold text-gray-900 mb-4">Invite Members</h1>
            <p className="text-lg text-gray-600">Add your team members to collaborate on Ignitic AI</p>
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
                    emailError ? "border-red-300 focus:border-red-500" : "border-gray-300 focus:border-emerald-500"
                  }`}
                />
                {emailError && <p className="absolute -bottom-6 left-0 text-sm text-red-600">{emailError}</p>}
              </div>

              {/* Contact Book Icon */}
              

              <Button
                onClick={handleAddEmail}
                className="bg-emerald-700 hover:bg-emerald-800 w-9 h-9 rounded-full flex items-center justify-center"
              >
                <Plus className="w-7 h-7" />
              </Button>
            </div>

            {/* Invited Emails List */}
            {invitedEmails.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Invited Members ({invitedEmails.length})</h3>
                <div className="space-y-2">
                  {invitedEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                          <Mail className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-gray-900">{email}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50"
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
                <p className="text-gray-500 mb-4">You can always invite team members later</p>
              </div>
            )}
          </div>
        </>
  )
}

export default Step3
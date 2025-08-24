'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sparkles, Send } from "lucide-react"

export function PromptBox() {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      console.log('Submitting prompt:', prompt)
      setPrompt('')
    }
  }

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent mb-3 font-generalSans">
            What would you like to automate?
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <div className="absolute left-6 top-1/2 transform -translate-y-1/2">
              <Sparkles className="w-6 h-6 text-blue-500 drop-shadow-sm" />
            </div>
            <Input
              type="text"
              placeholder="e.g., Automate customer onboarding emails, lead generation, or invoice processing..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="pl-16 pr-24 py-4 text-lg border-2 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 font-medium placeholder:text-slate-400"
            />
            <Button
              type="submit"
              disabled={!prompt.trim()}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg transition-all duration-200 text-lg font-semibold shadow-lg hover:shadow-xl"
            >
              <Send className="w-5 h-5 mr-2" />
              Send
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

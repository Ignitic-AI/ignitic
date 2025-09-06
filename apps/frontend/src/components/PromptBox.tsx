'use client'

import { useState } from 'react'
import { Search } from "lucide-react"
import { ChatWindow } from './ChatWindow'

export function PromptBox() {
  const [prompt, setPrompt] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  const handleSearchClick = () => {
    if (prompt.trim()) {
      console.log('Opening chat with prompt:', prompt)
      setIsChatOpen(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      console.log('Opening chat with prompt (form):', prompt)
      setIsChatOpen(true)
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-slate-300">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold text-slate-800 mb-6">
            What would you like to automate?
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="e.g., Automate customer onboarding emails, lead generation, or invoice processing..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full pl-14 pr-28 py-4 text-lg border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder:text-slate-400 hover:border-slate-300 transition-all duration-200"
            />
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={!prompt.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-200 hover:bg-blue-400 text-white px-8 py-3 rounded-lg transition-all duration-200 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg"
            >
              <Search className="w-8 h-8 text-blue-600" />
            </button>
          </div>
        </form>
      </div>

      {/* Chat Window */}
      <ChatWindow 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        initialQuery={prompt}
      />
    </>
  )
}

'use client'

import { useState } from 'react'

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
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-slate-800 mb-3">
          What would you like to automate?
        </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="e.g., Automate customer onboarding emails, lead generation, or invoice processing..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full pl-12 pr-24 py-4 text-base border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!prompt.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

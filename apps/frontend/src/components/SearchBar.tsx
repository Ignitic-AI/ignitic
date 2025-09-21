'use client'

import { useState } from 'react'
import { Search } from "lucide-react"

export function SearchBar() {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)

  return (
    <div className="relative hidden md:block">
      {isSearchExpanded ? (
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search workflows, tasks..."
            className="pl-2 pr-4 py-2 w-80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-all duration-300"
            autoFocus
          />
          <button 
            onClick={() => setIsSearchExpanded(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsSearchExpanded(true)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Search className="w-5 h-5 text-slate-600" />
        </button>
      )}
    </div>
  )
}

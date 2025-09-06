'use client'

import { useState } from 'react'
import { Search, Bot } from 'lucide-react'
import { ChatWindow } from './ChatWindow'

export function SearchBar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery)
      // Handle search logic here
    }
  }

  const openChat = () => {
    setIsChatOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative">
          {isExpanded ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="ml-2 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Search className="w-5 h-5 text-slate-600" />
            </button>
          )}
        </div>

        {/* Chat Button */}
        <button
          onClick={openChat}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">Chat</span>
        </button>
      </div>

      {/* Chat Window */}
      <ChatWindow 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        initialQuery=""
      />
    </>
  )
}

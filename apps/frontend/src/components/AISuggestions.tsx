'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import axios from 'axios'
import { useTodoStore } from '../store/useTodoStore'
import { Spinner } from './ui/spinner'
import * as LucideIcons from 'lucide-react'

const renderIcon = (iconStr: string) => {
  if (!iconStr) return '✨'
  
  // Try to find the icon in lucide-react dynamically
  // Convert things like "search" to "Search", or "arrow-right" to "ArrowRight"
  const formattedName = iconStr
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  
  const IconComponent = (LucideIcons as Record<string, any>)[formattedName]
  if (IconComponent) {
    return <IconComponent className="w-6 h-6 flex-shrink-0" />
  }

  // Fallback to exactly what the backend sent (e.g. an emoji)
  return iconStr
}

interface Suggestion {
  title: string
  description: string
  priority: string
  icon: string
  agent_name: string
  reasoning: string
  suggested_at_utc: string
}

interface SuggestResponse {
  goal: string
  count: number
  suggestions: Suggestion[]
}

const PRIORITY_COLORS: Record<string, { bg: string, text: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-600' },
  medium: { bg: 'bg-orange-100', text: 'text-orange-600' },
  low: { bg: 'bg-blue-100', text: 'text-blue-600' },
}

export function AISuggestions() {
  const { data: session } = useSession()
  const tasks = useTodoStore((state) => state.tasks)
  
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the latest uncompleted task that has a description
  const latestActiveTaskWithDesc = [...tasks]
    .reverse()
    .find(task => !task.completed && task.description && task.description.trim() !== '')

  const currentGoal = latestActiveTaskWithDesc?.description
  const token = session?.user?.token || (session as any)?.accessToken

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!currentGoal) {
        setSuggestions([])
        return
      }

      if (!token) return

      try {
        setIsLoading(true)
        setError(null)
        
        const response = await axios.post(
          'http://localhost:8080/api/v1/todos/suggest',
          { goal: currentGoal },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        const data: SuggestResponse = response.data
        setSuggestions(data.suggestions || [])
        
      } catch (err: any) {
        console.error('Error fetching suggestions:', err)
        setError('Failed to load AI suggestions.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSuggestions()
  }, [currentGoal, token])

  if (!currentGoal) {
    return (
      <div className="dark:bg-bg bg-bg-lm rounded-xl p-6 hover:shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
        <div className="text-4xl mb-4">🎯</div>
        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Ready to plan?</h3>
        <p className="text-slate-500 max-w-sm">
          Create a To Do Task with a description first, and let our AI generate smart suggestions for your workflows.
        </p>
      </div>
    )
  }

  return (
    <div className="dark:bg-bg bg-bg-lm rounded-xl p-6  hover:shadow-xl relative min-h-[300px] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-text-lm dark:text-text mb-2">AI Suggestions</h3>
        <p className="text-text-muted-lm dark:text-text-muted">Ecommerce Automation Workflows</p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-[150px]">
          <Spinner />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No suggestions found for this goal.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {suggestions.map((suggestion, index) => {
             const colors = PRIORITY_COLORS[suggestion.priority?.toLowerCase()] || { bg: 'bg-slate-100', text: 'text-slate-600' }
             
             return (
               <div 
                 key={index}
                 className={`${colors.bg} p-4 rounded-xl border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group`}
                 title={suggestion.reasoning}
               >
                 <div className="flex items-start gap-3">
                   <div className={`text-2xl flex items-center justify-center ${colors.text}`}>
                     {renderIcon(suggestion.icon)}
                   </div>
                   <div className="flex-1">
                     <div className="text-xs font-semibold uppercase text-slate-500 mb-1 flex items-center justify-between">
                       <span>{suggestion.agent_name}</span>
                       <span className={`px-2 py-0.5 rounded-full text-[10px] bg-white/50 border border-white`}>{suggestion.priority}</span>
                     </div>
                     <h4 className="font-semibold text-slate-800 mb-2 group-hover:text-slate-900 transition-colors">
                       {suggestion.title}
                     </h4>
                     <p className="text-xs text-slate-600 leading-relaxed">
                       {suggestion.description}
                     </p>
                   </div>
                 </div>
               </div>
             )
          })}
        </div>
      )}
    </div>
  )
}

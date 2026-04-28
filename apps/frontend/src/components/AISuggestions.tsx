'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useTodoStore } from '../store/useTodoStore'
import { Spinner } from './ui/spinner'
import * as LucideIcons from 'lucide-react'
import { ArrowUpRight, Sparkles, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const renderIcon = (iconStr: string) => {
  if (!iconStr) return '✨'
  
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

const PRIORITY_COLORS: Record<
  string,
  { panel: string; iconWrap: string; iconText: string; badge: string }
> = {
  high: {
    panel: 'border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(255,255,255,0.92))]',
    iconWrap: 'bg-rose-100',
    iconText: 'text-rose-600',
    badge: 'border-rose-200 bg-white text-rose-700',
  },
  medium: {
    panel: 'border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.92))]',
    iconWrap: 'bg-amber-100',
    iconText: 'text-amber-600',
    badge: 'border-amber-200 bg-white text-amber-700',
  },
  low: {
    panel: 'border-sky-200/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(255,255,255,0.92))]',
    iconWrap: 'bg-sky-100',
    iconText: 'text-sky-600',
    badge: 'border-sky-200 bg-white text-sky-700',
  },
}

export function AISuggestions() {
  const { data: session } = useSession()
  const router = useRouter()
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

  const openSuggestionInNewChat = (prompt: string) => {
    const chatId = crypto.randomUUID()
    const url = `/chat/${chatId}?prompt=${encodeURIComponent(prompt)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

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
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border-lm/80 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.9))] p-8 text-center shadow-sm dark:border-border dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_38%),linear-gradient(180deg,rgba(22,24,29,0.96),rgba(15,23,42,0.88))]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-lm/70 bg-white text-primary-lm shadow-sm dark:border-border dark:bg-bg-light dark:text-primary">
          <Wand2 className="h-7 w-7" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-text-lm dark:text-text">Ready to generate smarter next steps?</h3>
        <p className="max-w-md text-sm leading-6 text-text-muted-lm dark:text-text-muted">
          Create a To Do Task with a description first, and let our AI generate smart suggestions for your workflows.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border-lm bg-white px-4 py-2 text-sm font-medium text-text-lm transition-colors hover:bg-slate-50 dark:border-border dark:bg-bg-light dark:text-text dark:hover:bg-highlight"
        >
          <Sparkles className="h-4 w-4" />
          Go to dashboard
        </button>
      </div>
    )
  }

  return (
    <section className="relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-border-lm/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-6 shadow-sm dark:border-border dark:bg-[linear-gradient(180deg,rgba(18,24,34,0.98),rgba(12,18,28,0.96))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(14,116,244,0.12),transparent_58%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_58%)]" />

      <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-lm/70 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted-lm shadow-sm dark:border-border dark:bg-bg-light dark:text-text-muted">
            <Sparkles className="h-3.5 w-3.5" />
            AI Suggestions
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-text-lm dark:text-text">Workflow recommendations</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted-lm dark:text-text-muted">
              Based on your latest active goal. Clicking a suggestion opens a new chat tab with the prompt prefilled.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border-lm/70 bg-white/80 px-4 py-3 text-left shadow-sm dark:border-border dark:bg-bg-light/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted-lm dark:text-text-muted">
            Current Goal
          </p>
          <p className="mt-1 line-clamp-3 text-sm font-medium text-text-lm dark:text-text">
            {currentGoal}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[180px] flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted-lm dark:text-text-muted">
          No suggestions found for this goal.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {suggestions.map((suggestion, index) => {
             const colors = PRIORITY_COLORS[suggestion.priority?.toLowerCase()] || {
               panel: 'border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.92))]',
               iconWrap: 'bg-slate-100',
               iconText: 'text-slate-600',
               badge: 'border-slate-200 bg-white text-slate-700',
             }
             const prompt = `${suggestion.title}\n\n${suggestion.description}`
             
             return (
               <button
                 type="button"
                 key={index}
                 onClick={() => openSuggestionInNewChat(prompt)}
                 className={cn(
                   'group relative overflow-hidden rounded-3xl border p-5 text-left transition-all duration-200',
                   'hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-lm dark:focus-visible:ring-primary',
                   colors.panel
                 )}
                 title={suggestion.reasoning}
               >
                 <div className="absolute right-4 top-4 flex items-center gap-2 text-xs font-medium text-text-muted-lm opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-text-muted">
                   Open chat
                   <ArrowUpRight className="h-4 w-4" />
                 </div>

                 <div className="flex items-start gap-4">
                   <div className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/70 shadow-sm', colors.iconWrap, colors.iconText)}>
                     {renderIcon(suggestion.icon)}
                   </div>
                   <div className="min-w-0 flex-1">
                     <div className="mb-3 flex items-start justify-between gap-3">
                       <div className="min-w-0">
                         <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted-lm dark:text-text-muted">
                           {suggestion.agent_name.replaceAll('_', ' ')}
                         </p>
                         <h4 className="mt-2 text-xl font-semibold leading-tight text-slate-900 transition-colors group-hover:text-black dark:text-white">
                           {suggestion.title}
                         </h4>
                       </div>
                       <span className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide', colors.badge)}>
                         {suggestion.priority}
                       </span>
                     </div>

                     <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                       {suggestion.description}
                     </p>

                     <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/5 pt-4 dark:border-white/10">
                       <p className="line-clamp-1 text-xs text-text-muted-lm dark:text-text-muted">
                         {suggestion.reasoning}
                       </p>
                       <span className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-slate-700 transition-colors group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white">
                         Start chat
                         <ArrowUpRight className="h-4 w-4" />
                       </span>
                     </div>
                   </div>
                 </div>
               </button>
             )
          })}
        </div>
      )}
    </section>
  )
}

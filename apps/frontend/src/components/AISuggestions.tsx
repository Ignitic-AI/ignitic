'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useTodoStore } from '../store/useTodoStore'
import { Spinner } from './ui/spinner'
import * as LucideIcons from 'lucide-react'
import { ArrowUpRight, Sparkles, Wand2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { API_V1_BASE_URL } from '@/lib/api'

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
  { iconWrap: string; iconText: string; badge: string; corner: string }
> = {
  high: {
    iconWrap: 'bg-danger-lm/15 dark:bg-danger/20',
    iconText: 'text-danger-lm dark:text-danger',
    badge: 'border-danger-lm/40 dark:border-danger/40 bg-danger-lm/10 dark:bg-danger/15 text-danger-lm dark:text-danger',
    corner: 'border-danger-lm dark:border-danger',
  },
  medium: {
    iconWrap: 'bg-primary-lm/15 dark:bg-primary/20',
    iconText: 'text-primary-lm dark:text-primary',
    badge: 'border-primary-lm/40 dark:border-primary/40 bg-primary-lm/10 dark:bg-primary/15 text-primary-lm dark:text-primary',
    corner: 'border-primary-lm dark:border-primary',
  },
  low: {
    iconWrap: 'bg-success-lm/15 dark:bg-success/20',
    iconText: 'text-success-lm dark:text-success',
    badge: 'border-success-lm/40 dark:border-success/40 bg-success-lm/10 dark:bg-success/15 text-success-lm dark:text-success',
    corner: 'border-success-lm dark:border-success',
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
          `${API_V1_BASE_URL}/todos/suggest`,
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
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[4px] border border-dashed border-border-lm/80 bg-bg-lm p-8 text-center shadow-sm dark:border-border dark:bg-bg">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] border border-border-lm bg-bg-light-lm text-primary-lm shadow-sm dark:border-border dark:bg-bg-light dark:text-primary">
          <Wand2 className="h-7 w-7" />
        </div>
        <h3 className="mb-2 text-xl font-semibold font-generalSans text-text-lm dark:text-text">Ready to generate smarter next steps?</h3>
        <p className="max-w-md text-sm leading-6 font-generalSans text-text-muted-lm dark:text-text-muted">
          Create a To Do Task with a description first, and let our AI generate smart suggestions for your workflows.
        </p>
       
      </div>
    )
  }

  return (
    <section className="flex min-h-[320px] flex-col rounded-xl bg-bg-lm dark:bg-bg p-6 shadow-sm font-generalSans">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted-lm dark:text-text-muted mb-2">
          AI Suggestions
        </p>
        <h3 className="text-2xl md:text-3xl font-semibold font-generalSans text-text-lm dark:text-text">
          Workflow recommendations
        </h3>
        <p className="mt-1 text-sm leading-6 font-generalSans text-text-muted-lm dark:text-text-muted">
          Based on your latest active goal. Clicking a suggestion opens a new chat tab with the prompt prefilled.
        </p>
      </div>

      <div className="mb-6 mt-2 flex flex-wrap items-center gap-2 border-b border-border-lm dark:border-border pb-4">
        <span className="text-[14px] font-semibold uppercase tracking-[0.16em] text-text-muted-lm dark:text-text-muted">
          Current Goal:
        </span>
        <p className="text-lg font-semibold font-generalSans text-text-lm dark:text-text line-clamp-1">
          {currentGoal}
        </p>
      </div>

      {isLoading ? (
        <div className="flex min-h-[180px] flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger-lm/40 dark:border-danger/40 bg-danger-lm/10 dark:bg-danger/15 p-4 text-center">
          <p className="text-sm font-generalSans text-danger-lm dark:text-danger">{error}</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="py-8 text-center text-sm font-generalSans text-text-muted-lm dark:text-text-muted">
          No suggestions found for this goal.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {suggestions.map((suggestion, index) => {
             const colors = PRIORITY_COLORS[suggestion.priority?.toLowerCase()] || {
               iconWrap: 'bg-bg-lm dark:bg-bg',
               iconText: 'text-text-muted-lm dark:text-text-muted',
               badge: 'border-border-lm dark:border-border bg-bg-lm dark:bg-bg text-text-muted-lm dark:text-text-muted',
               corner: 'border-border-lm dark:border-border',
             }
             const prompt = `${suggestion.title}\n\n${suggestion.description}`
             const cornerColor = colors.corner
             
             return (
               <motion.button
                 type="button"
                 key={index}
                 onClick={() => openSuggestionInNewChat(prompt)}
                 initial="rest"
                 whileHover="hover"
                 className={cn(
                   'group w-full relative overflow-hidden rounded-[4px] bg-bg-light-lm dark:bg-bg-light p-4 text-left transition-colors duration-200',
                   'hover:bg-bg-light-lm/80 dark:hover:bg-bg-light/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-lm dark:focus-visible:ring-primary'
                 )}
                 title={suggestion.reasoning}
               >
                 <div className={cn('pointer-events-none absolute left-0 top-0 h-5 w-5 border-l-[3px] border-t-[3px]', cornerColor)} />
                 <div className={cn('pointer-events-none absolute right-0 top-0 h-5 w-5 border-r-[3px] border-t-[3px]', cornerColor)} />
                 <div className={cn('pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b-[3px] border-l-[3px]', cornerColor)} />
                 <div className={cn('pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b-[3px] border-r-[3px]', cornerColor)} />

                 <div className="flex items-start gap-4">
                   {/* <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[4px] border border-border-lm dark:border-border', colors.iconWrap, colors.iconText)}>
                     {renderIcon(suggestion.icon)}
                   </div> */}
                   <div className="min-w-0 flex-1">
                     <div className="mb-2 flex items-start justify-between gap-3">
                       <div className="min-w-0">
                         <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted-lm dark:text-text-muted">
                           {suggestion.agent_name.replaceAll('_', ' ')}
                         </p>
                         <h4 className="mt-1 text-lg font-semibold font-generalSans leading-tight text-text-lm dark:text-text">
                           {suggestion.title}
                         </h4>
                       </div>
                       <span className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide', colors.badge)}>
                         {suggestion.priority}
                       </span>
                     </div>

                     <p className="text-sm leading-6 font-generalSans text-text-muted-lm dark:text-text-muted">
                       {suggestion.description}
                     </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-generalSans text-text-muted-lm dark:text-text-muted">
                         {suggestion.reasoning}
                       </p>
                      <span className="inline-flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-2 border-border bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] px-4 py-2 text-sm font-medium font-generalSans text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] dark:border-highlight-lm dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]">
                        Start Chat
                           <motion.span
                             variants={{
                               rest: { rotate: 45 },
                               hover: { rotate: 0 },
                             }}
                             transition={{ duration: 0.2, ease: 'easeOut' }}
                             className="inline-flex"
                           >
                             <ArrowUpRight className="h-4 w-4" />
                           </motion.span>
                      </span>
                     </div>
                   </div>
                 </div>
               </motion.button>
             )
          })}
        </div>
      )}
    </section>
  )
}

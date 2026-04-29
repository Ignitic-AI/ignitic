import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface TodoFromAPI {
  id: string
  user_id: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'done'
  progress: number
  is_agent_task: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface TodosResponse {
  count: number
  todos: TodoFromAPI[]
}

export interface Task {
  id: string
  text: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  icon: string
  progress: number
  amount: string
}

export interface CreateTaskPayload {
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status?: 'todo' | 'in_progress' | 'done'
  progress?: number
  icon?: string
  due_date?: string
  scheduled_at?: string
  monetary_value?: number
  tags?: string[]
}

const getTaskIcon = (title: string, isAgentTask: boolean): string => {
  if (isAgentTask) return '🤖'
  const lowerTitle = title.toLowerCase()
  if (lowerTitle.includes('email')) return '✉️'
  if (lowerTitle.includes('lead') || lowerTitle.includes('facebook')) return '📱'
  if (lowerTitle.includes('ad')) return '📢'
  if (lowerTitle.includes('report')) return '📊'
  return '📝'
}

interface TodoStore {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  filterType: 'all' | 'status' | 'priority'
  filterValue: string
  
  setFilterType: (type: 'all' | 'status' | 'priority') => void
  setFilterValue: (value: string) => void
  
  fetchTodos: (token: string) => Promise<void>
  createTask: (token: string, payload: {
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high'
    status?: 'todo' | 'in_progress' | 'done'
    progress?: number
    icon?: string
    due_date?: string
    scheduled_at?: string
    monetary_value?: number
    tags?: string[]
  }) => Promise<void>
  deleteTask: (token: string, id: string) => Promise<void>
  completeTask: (token: string, id: string) => Promise<void>
}

const mapTodoToTask = (todo: TodoFromAPI): Task => ({
  id: todo.id,
  text: todo.title,
  description: todo.description,
  completed: todo.status === 'done',
  priority: todo.priority,
  icon: getTaskIcon(todo.title, todo.is_agent_task),
  progress: todo.progress,
  amount: '$0',
})

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      isLoading: false,
      error: null,
      filterType: 'all',
      filterValue: 'all',

      setFilterType: (type) => set({ filterType: type, filterValue: 'all' }),
      setFilterValue: (value) => set({ filterValue: value }),

      fetchTodos: async (token: string) => {
        if (!token) {
          set({ isLoading: false })
          return
        }

        try {
          set({ isLoading: true, error: null })

          const response = await fetch('http://localhost:8080/api/v1/todos', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            throw new Error('Failed to fetch todos')
          }

          const data: TodosResponse = await response.json()
          const mappedTasks: Task[] = data.todos.map(mapTodoToTask)
          set({ tasks: mappedTasks, isLoading: false })
        } catch (err) {
          console.error('Error fetching todos:', err)
          set({ error: err instanceof Error ? err.message : 'Failed to fetch todos', isLoading: false })
        }
      },

      createTask: async (token: string, payload: {
        title: string
        description?: string
        priority?: 'low' | 'medium' | 'high'
        status?: 'todo' | 'in_progress' | 'done'
        progress?: number
        icon?: string
        due_date?: string
        scheduled_at?: string
        monetary_value?: number
        tags?: string[]
      }) => {
        if (!token || !payload.title.trim()) return

        const body: Record<string, unknown> = {
          title: payload.title.trim(),
          priority: payload.priority ?? 'medium',
        }
        if (payload.description != null && payload.description.trim()) body.description = payload.description.trim()
        if (payload.status != null) body.status = payload.status
        if (payload.progress != null) body.progress = payload.progress
        if (payload.icon != null && payload.icon.trim()) body.icon = payload.icon.trim()
        if (payload.due_date != null && payload.due_date.trim()) body.due_date = payload.due_date.trim()
        if (payload.scheduled_at != null && payload.scheduled_at.trim()) body.scheduled_at = payload.scheduled_at.trim()
        if (payload.monetary_value != null && !isNaN(payload.monetary_value)) body.monetary_value = payload.monetary_value
        if (payload.tags != null && payload.tags.length > 0) body.tags = payload.tags

        try {
          const response = await fetch('http://localhost:8080/api/v1/todos', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          })

          if (!response.ok) {
            throw new Error('Failed to create task')
          }

          const responseData = await response.json().catch(() => null)
          const createdTodo: TodoFromAPI | null = responseData?.todo || responseData?.data || responseData || null

          if (createdTodo?.id) {
            set((state) => ({ tasks: [mapTodoToTask(createdTodo), ...state.tasks] }))
            return
          }

          const optimisticTask: Task = {
            id: `temp-${Date.now()}`,
            text: payload.title.trim(),
            description: payload.description?.trim(),
            completed: payload.status === 'done',
            priority: payload.priority ?? 'medium',
            icon: payload.icon?.trim() || getTaskIcon(payload.title, false),
            progress: payload.progress ?? 0,
            amount: '$0',
          }
          set((state) => ({ tasks: [optimisticTask, ...state.tasks] }))
        } catch (err) {
          console.error('Error creating task:', err)
          throw err
        }
      },

      deleteTask: async (token: string, id: string) => {
        if (!token || !id) return

        try {
          const response = await fetch(`http://localhost:8080/api/v1/todos/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (!response.ok) {
            throw new Error('Failed to delete task')
          }

          set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }))
          await get().fetchTodos(token)
        } catch (err) {
          console.error('Error deleting task:', err)
          throw err
        }
      },

      completeTask: async (token: string, id: string) => {
        if (!token || !id) return

        const previousTasks = get().tasks
        set((state) => ({
          tasks: state.tasks.map((task) => (
            task.id === id
              ? { ...task, completed: true, progress: Math.max(task.progress, 100) }
              : task
          )),
        }))

        try {
          const payload = { status: 'done', progress: 100 }
          const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }

          let response = await fetch(`http://localhost:8080/api/v1/todos/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            response = await fetch(`http://localhost:8080/api/v1/todos/${id}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(payload),
            })
          }

          if (!response.ok) {
            throw new Error('Failed to mark task complete')
          }

          await get().fetchTodos(token)
        } catch (err) {
          set({ tasks: previousTasks })
          console.error('Error marking task complete:', err)
          throw err
        }
      }
    }),
    {
      name: 'todo-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        filterType: state.filterType,
        filterValue: state.filterValue,
      }),
    }
  )
)

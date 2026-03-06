import { create } from 'zustand'

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
  toggleTask: (id: string) => void
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  tasks: [],
  isLoading: true,
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
      const { filterType, filterValue } = get()
      
      let url = 'http://localhost:8080/api/v1/todos'
      if (filterType === 'status' && filterValue !== 'all') {
        url = `http://localhost:8080/api/v1/todos/status/${filterValue}`
      } else if (filterType === 'priority' && filterValue !== 'all') {
        url = `http://localhost:8080/api/v1/todos/priority/${filterValue}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch todos')
      }

      const data: TodosResponse = await response.json()
      
      const mappedTasks: Task[] = data.todos.map(todo => ({
        id: todo.id,
        text: todo.title,
        description: todo.description,
        completed: todo.status === 'done',
        priority: todo.priority,
        icon: getTaskIcon(todo.title, todo.is_agent_task),
        progress: todo.progress,
        amount: '$0'
      }))

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

      // Refetch todos to get the new task and correct ordering
      await get().fetchTodos(token)
    } catch (err) {
      console.error('Error creating task:', err)
      throw err // Allow UI to show error toast
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

      // Refetch todos to update the list
      await get().fetchTodos(token)
    } catch (err) {
      console.error('Error deleting task:', err)
      throw err // Allow UI to show error toast
    }
  },

  toggleTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    }))
  }
}))

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"

// Type definitions for API response
interface TodoFromAPI {
  id: string
  user_id: string
  title: string
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'done'
  progress: number
  is_agent_task: boolean
  created_by: string
  created_at: string
  updated_at: string
}

interface TodosResponse {
  count: number
  todos: TodoFromAPI[]
}

// Type for internal task representation
interface Task {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  icon: string
  progress: number
  amount: string
}

// Helper function to get icon based on task title or type
const getTaskIcon = (title: string, isAgentTask: boolean): string => {
  if (isAgentTask) return '🤖'
  const lowerTitle = title.toLowerCase()
  if (lowerTitle.includes('email')) return '✉️'
  if (lowerTitle.includes('lead') || lowerTitle.includes('facebook')) return '📱'
  if (lowerTitle.includes('ad')) return '📢'
  if (lowerTitle.includes('report')) return '📊'
  return '📝'
}

export function Checklist() {
  const { data: session, status } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [isCreating, setIsCreating] = useState(false)
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch todos from API
  useEffect(() => {
    const fetchTodos = async () => {
      if (!session?.user?.token) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const response = await fetch('http://localhost:8080/api/v1/todos', {
          headers: {
            'Authorization': `Bearer ${session.user.token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch todos')
        }

        const data: TodosResponse = await response.json()
        
        // Map API todos to internal task structure
        const mappedTasks: Task[] = data.todos.map(todo => ({
          id: todo.id,
          text: todo.title,
          completed: todo.status === 'done',
          priority: todo.priority,
          icon: getTaskIcon(todo.title, todo.is_agent_task),
          progress: todo.progress,
          amount: '$0' // API doesn't provide amount, using default
        }))

        setTasks(mappedTasks)
        setError(null)
      } catch (err) {
        console.error('Error fetching todos:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch todos')
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'loading') return

    if (status === 'authenticated' && session?.user?.token) {
      fetchTodos()
    } else {
      setIsLoading(false)
    }
  }, [session, status])

  // Helper function to refetch todos
  const refetchTodos = async () => {
    if (!session?.user?.token) return

    try {
      const response = await fetch('http://localhost:8080/api/v1/todos', {
        headers: {
          'Authorization': `Bearer ${session.user.token}`,
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
        completed: todo.status === 'done',
        priority: todo.priority,
        icon: getTaskIcon(todo.title, todo.is_agent_task),
        progress: todo.progress,
        amount: '$0'
      }))

      setTasks(mappedTasks)
    } catch (err) {
      console.error('Error refetching todos:', err)
    }
  }

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ))
  }

  const createTask = async () => {
    if (!taskTitle.trim() || !session?.user?.token) return

    try {
      setIsCreating(true)
      const response = await fetch('http://localhost:8080/api/v1/todos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskTitle.trim(),
          priority: taskPriority,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create task')
      }

      toast.success('Task created successfully')
      setIsDialogOpen(false)
      setTaskTitle('')
      setTaskPriority('medium')
      
      // Refetch todos to get the new task
      await refetchTodos()
    } catch (err) {
      console.error('Error creating task:', err)
      toast.error('Failed to create task')
    } finally {
      setIsCreating(false)
    }
  }

  const addTask = () => {
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setTaskToDelete(id)
    setIsDeleteDialogOpen(true)
  }

  const deleteTask = async () => {
    if (!taskToDelete || !session?.user?.token) return

    try {
      setIsDeleting(true)
      const response = await fetch(`http://localhost:8080/api/v1/todos/${taskToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.user.token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete task')
      }

      toast.success('Task deleted successfully')
      setIsDeleteDialogOpen(false)
      setTaskToDelete(null)
      
      // Refetch todos to update the list
      await refetchTodos()
    } catch (err) {
      console.error('Error deleting task:', err)
      toast.error('Failed to delete task')
    } finally {
      setIsDeleting(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200'
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'low': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 60) return 'bg-blue-500'
    if (progress >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="dark:bg-bg bg-bg-lm rounded-xl p-5 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-lm dark:text-text mb-1">To-do List</h3>
          <p className="text-sm text-text-muted-lm dark:text-text-muted">Track your progress</p>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-all duration-200 hover:scale-105">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      {/* Add new task button */}
      <div className="mb-4">
        <Button
          onClick={addTask}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all duration-200 hover:shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add new task
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Task list */}
      {!isLoading && !error && (
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`group p-3 rounded-lg border transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer ${
              task.completed 
                ? 'bg-slate-50 border-slate-200' 
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => toggleTask(task.id)}
          >
            <div className="flex items-start gap-3">
              {/* Task Icon */}
              <div className="text-xl mt-1">{task.icon}</div>
              
              {/* Task Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4
                    className={`font-medium text-sm ${
                      task.completed 
                        ? 'text-slate-500 line-through' 
                        : 'text-slate-700'
                    }`}
                  >
                    {task.text}
                  </h4>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span>
                    <span>{task.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(task.progress)}`}
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Amount */}
                <div className="text-sm font-semibold text-slate-600">
                  {task.amount}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteClick(task.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-600"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="w-4 h-4 text-blue-500 border-slate-300 rounded focus:ring-blue-500 hover:scale-110 transition-transform duration-200"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
      
      {/* View All Link */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <button className="w-full text-center text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors duration-200 hover:underline">
          View All Tasks
        </button>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-generalSans">Create New Task</DialogTitle>
            <DialogDescription className="font-generalSans">
              Add a new task to your to-do list. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="font-generalSans">
                Title
              </Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="font-generalSans"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority" className="font-generalSans">
                Priority
              </Label>
              <Select value={taskPriority} onValueChange={(value: 'low' | 'medium' | 'high') => setTaskPriority(value)}>
                <SelectTrigger className="font-generalSans">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="font-generalSans">Low</SelectItem>
                  <SelectItem value="medium" className="font-generalSans">Medium</SelectItem>
                  <SelectItem value="high" className="font-generalSans">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isCreating}
              className="font-generalSans"
            >
              Cancel
            </Button>
            <Button
              onClick={createTask}
              disabled={!taskTitle.trim() || isCreating}
              className="font-generalSans"
            >
              {isCreating ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-generalSans">Delete Task</DialogTitle>
            <DialogDescription className="font-generalSans">
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="font-generalSans"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteTask}
              disabled={isDeleting}
              className="font-generalSans"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

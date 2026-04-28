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
import { Spinner } from './ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { useTodoStore } from '../store/useTodoStore'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"


export function Checklist() {
  const { data: session, status } = useSession()
  const {
    tasks, isLoading, error, filterType, filterValue,
    setFilterType, setFilterValue, fetchTodos, 
    createTask: storeCreateTask, deleteTask: storeDeleteTask, toggleTask
  } = useTodoStore()
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [isCreating, setIsCreating] = useState(false)
  // Optional fields
  const [taskStatus, setTaskStatus] = useState<'todo' | 'in_progress' | 'done' | ''>('')
  const [taskProgress, setTaskProgress] = useState('')
  const [taskIcon, setTaskIcon] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskScheduledAt, setTaskScheduledAt] = useState('')
  const [taskMonetaryValue, setTaskMonetaryValue] = useState('')
  const [taskTags, setTaskTags] = useState('')
  const [showOptionalFields, setShowOptionalFields] = useState(false)

  const resetTaskForm = () => {
    setTaskTitle('')
    setTaskDescription('')
    setTaskPriority('medium')
    setTaskStatus('')
    setTaskProgress('')
    setTaskIcon('')
    setTaskDueDate('')
    setTaskScheduledAt('')
    setTaskMonetaryValue('')
    setTaskTags('')
    setShowOptionalFields(false)
  }
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch todos from API
  useEffect(() => {
    const token = session?.user?.token || (session as any)?.accessToken

    if (status === 'loading') return

    if (status === 'authenticated' && token) {
      fetchTodos(token)
    } else if (status === 'unauthenticated') {
      useTodoStore.setState({ isLoading: false })
    }
  }, [session, status, filterType, filterValue, fetchTodos])

  const createTask = async () => {
    const token = session?.user?.token || (session as any)?.accessToken
    if (!taskTitle.trim() || !token) return

    try {
      setIsCreating(true)
      await storeCreateTask(token, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
        status: taskStatus || undefined,
        progress: taskProgress !== '' ? Number(taskProgress) : undefined,
        icon: taskIcon || undefined,
        due_date: taskDueDate || undefined,
        scheduled_at: taskScheduledAt || undefined,
        monetary_value: taskMonetaryValue !== '' ? Number(taskMonetaryValue) : undefined,
        tags: taskTags.trim() ? taskTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      })

      toast.success('Task created successfully')
      setIsDialogOpen(false)
      resetTaskForm()
    } catch (err) {
      console.error('Error creating task:', err)
      toast.error('Failed to create task')
    } finally {
      setIsCreating(false)
    }
  }

  const addTask = () => {
    if (status !== 'authenticated') {
      toast.error('Sign Up to Add Task')
      return
    }
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setTaskToDelete(id)
    setIsDeleteDialogOpen(true)
  }

  const deleteTask = async () => {
    const token = session?.user?.token || (session as any)?.accessToken
    if (!taskToDelete || !token) return

    try {
      setIsDeleting(true)
      await storeDeleteTask(token, taskToDelete)

      toast.success('Task deleted successfully')
      setIsDeleteDialogOpen(false)
      setTaskToDelete(null)
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
    <div className="dark:bg-bg bg-bg-lm rounded-xl p-5  shadow-lg ml-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-lm dark:text-text mb-1">Task List</h3>
          <p className="text-sm text-text-muted-lm dark:text-text-muted">Track your progress</p>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-all duration-200 hover:scale-105">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Filters */}

      
      {/* Filters and Add Task */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={(value: 'all' | 'status' | 'priority') => {
            setFilterType(value)
            setFilterValue('all') // Reset value when type changes
          }}>
            <SelectTrigger className="w-[130px] h-8 text-xs font-generalSans">
              <SelectValue placeholder="Filter By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-generalSans">All Tasks</SelectItem>
              <SelectItem value="status" className="font-generalSans">Status</SelectItem>
              <SelectItem value="priority" className="font-generalSans">Priority</SelectItem>
            </SelectContent>
          </Select>

          {filterType === 'status' && (
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[130px] h-8 text-xs font-generalSans">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-generalSans">All Statuses</SelectItem>
                <SelectItem value="todo" className="font-generalSans">To Do</SelectItem>
                <SelectItem value="in_progress" className="font-generalSans">In Progress</SelectItem>
                <SelectItem value="done" className="font-generalSans">Done</SelectItem>
              </SelectContent>
            </Select>
          )}

          {filterType === 'priority' && (
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[130px] h-8 text-xs font-generalSans">
                <SelectValue placeholder="Select Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-generalSans">All Priorities</SelectItem>
                <SelectItem value="low" className="font-generalSans">Low</SelectItem>
                <SelectItem value="medium" className="font-generalSans">Medium</SelectItem>
                <SelectItem value="high" className="font-generalSans">High</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <Button
          onClick={addTask}
          className="h-8 dark:bg-slate-700 bg-slate-500 dark:hover:bg-slate-800 hover:bg-slate-600 text-white font-medium text-xs transition-all duration-200 hover:shadow-lg px-3"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add new task
        </Button>
      </div>
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center">
          <Spinner />
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
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`group p-3 rounded-lg border transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer ${
              task.completed 
                ? 'dark:bg-bg-light bg-bg-light-lm border-zinc-600' 
                : 'dark:bg-bg-light bg-bg-light-lm border-slate-200'
            }`}
            onClick={() => toggleTask(task.id)}
          >
            <div className="flex items-start gap-3">
              {/* Task Icon */}
              <div className="text-xl mt-1">{task.icon}</div>
              
              {/* Task Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
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
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1  rounded text-red-500 hover:text-red-600"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* Checkbox
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="w-4 h-4 text-blue-500 border-slate-300 rounded focus:ring-blue-500 hover:scale-110 transition-transform duration-200"
                /> */}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
      
      

      {/* Add Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[85dvh] grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-6">
          <DialogHeader className="py-0">
            <DialogTitle className="font-generalSans">Create New Task</DialogTitle>
            <DialogDescription className="font-generalSans">
              Add a new task to your to-do list. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto min-h-0 overscroll-contain pr-1">
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
              <Label htmlFor="description" className="font-generalSans">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="description"
                placeholder="Enter task description... (optional)"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
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

            <Collapsible open={showOptionalFields} onOpenChange={setShowOptionalFields}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between font-generalSans -mx-2">
                  More options (optional)
                  {showOptionalFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-4 pt-4">
                <div className="grid gap-2">
                  <Label className="font-generalSans">Status</Label>
                  <Select value={taskStatus || 'none'} onValueChange={(v) => setTaskStatus(v === 'none' ? '' : v as 'todo' | 'in_progress' | 'done')}>
                    <SelectTrigger className="font-generalSans">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-generalSans">—</SelectItem>
                      <SelectItem value="todo" className="font-generalSans">To Do</SelectItem>
                      <SelectItem value="in_progress" className="font-generalSans">In Progress</SelectItem>
                      <SelectItem value="done" className="font-generalSans">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="font-generalSans">Progress (0-100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={taskProgress}
                    onChange={(e) => setTaskProgress(e.target.value)}
                    className="font-generalSans"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-generalSans">Icon</Label>
                  <Select value={taskIcon || 'none'} onValueChange={(v) => setTaskIcon(v === 'none' ? '' : v)}>
                    <SelectTrigger className="font-generalSans">
                      <SelectValue placeholder="Select icon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-generalSans">—</SelectItem>
                      <SelectItem value="report" className="font-generalSans">📊 Report</SelectItem>
                      <SelectItem value="email" className="font-generalSans">✉️ Email</SelectItem>
                      <SelectItem value="lead" className="font-generalSans">📱 Lead</SelectItem>
                      <SelectItem value="ad" className="font-generalSans">📢 Ad</SelectItem>
                      <SelectItem value="task" className="font-generalSans">📝 Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="font-generalSans">Due date</Label>
                  <Input
                    type="datetime-local"
                    value={taskDueDate ? taskDueDate.slice(0, 16) : ''}
                    onChange={(e) => setTaskDueDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="font-generalSans"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-generalSans">Scheduled at</Label>
                  <Input
                    type="datetime-local"
                    value={taskScheduledAt ? taskScheduledAt.slice(0, 16) : ''}
                    onChange={(e) => setTaskScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="font-generalSans"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-generalSans">Monetary value ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0"
                    value={taskMonetaryValue}
                    onChange={(e) => setTaskMonetaryValue(e.target.value)}
                    className="font-generalSans"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-generalSans">Tags (comma-separated)</Label>
                  <Input
                    placeholder="urgent, client"
                    value={taskTags}
                    onChange={(e) => setTaskTags(e.target.value)}
                    className="font-generalSans"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4 mt-2">
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

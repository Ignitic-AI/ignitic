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
    createTask: storeCreateTask, deleteTask: storeDeleteTask, completeTask
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

  // Keep unauthenticated state from showing indefinite loading.
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      useTodoStore.setState({ isLoading: false })
    }
  }, [status])

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

  const handleRefreshTasks = async () => {
    const token = session?.user?.token || (session as any)?.accessToken
    if (!token) return

    try {
      await fetchTodos(token)
      toast.success('Tasks refreshed')
    } catch {
      toast.error('Failed to refresh tasks')
    }
  }

  const handleMarkComplete = async (id: string) => {
    const token = session?.user?.token || (session as any)?.accessToken
    if (!token) return

    try {
      await completeTask(token, id)
      toast.success('Task marked complete')
    } catch (err) {
      console.error('Error marking task complete:', err)
      toast.error('Failed to mark task complete')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-danger-lm/15 dark:bg-danger/20 text-danger-lm dark:text-danger border-danger-lm/30 dark:border-danger/30'
      case 'medium': return 'bg-warning-lm/15 dark:bg-warning/20 text-warning-lm dark:text-warning border-warning-lm/30 dark:border-warning/30'
      case 'low': return 'bg-success-lm/15 dark:bg-success/20 text-success-lm dark:text-success border-success-lm/30 dark:border-success/30'
      default: return 'bg-bg-light-lm dark:bg-bg-light text-text-muted-lm dark:text-text-muted border-border-lm dark:border-border'
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-success-lm dark:bg-success'
    if (progress >= 60) return 'bg-info-lm dark:bg-info'
    if (progress >= 40) return 'bg-warning-lm dark:bg-warning'
    return 'bg-danger-lm dark:bg-danger'
  }

  const filteredTasks = tasks.filter((task) => {
    if (filterType === 'all' || filterValue === 'all') return true
    if (filterType === 'priority') return task.priority === filterValue
    if (filterType === 'status') {
      const derivedStatus = task.completed ? 'done' : (task.progress > 0 ? 'in_progress' : 'todo')
      return derivedStatus === filterValue
    }
    return true
  })

  return (
    <div className="bg-bg-lm dark:bg-bg rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-lm dark:text-text mb-1">Task List</h3>
          <p className="text-sm text-text-muted-lm dark:text-text-muted">Track your progress</p>
        </div>
        <button onClick={handleRefreshTasks} className="p-2 hover:bg-bg-light-lm dark:hover:bg-bg-light rounded-[4px] transition-all duration-200">
          <svg className="w-5 h-5 text-text-muted-lm dark:text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`group p-4 rounded-[4px] transition-all duration-200 shadow-sm ${
              task.completed 
                ? 'dark:bg-bg-light/80 bg-bg-light-lm/80' 
                : 'dark:bg-bg-light bg-bg-light-lm'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Task Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <h4
                    className={`font-semibold text-base leading-tight ${
                      task.completed 
                        ? 'text-text-muted-lm dark:text-text-muted line-through' 
                        : 'text-text-lm dark:text-text'
                    }`}
                  >
                    {task.text}
                  </h4>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>

                {!!task.description && (
                  <p className="mb-2 text-xs leading-5 text-text-muted-lm dark:text-text-muted line-clamp-2">
                    {task.description}
                  </p>
                )}
                
                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-text-muted-lm dark:text-text-muted mb-1">
                    <span>Progress</span>
                    <span>{task.progress}%</span>
                  </div>
                  <div className="w-full bg-border-lm/40 dark:bg-border/50 h-2 rounded-none">
                    <div 
                      className={`h-2 rounded-none transition-all duration-300 ${getProgressColor(task.progress)}`}
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text-muted-lm dark:text-text-muted">
                    {task.amount}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleMarkComplete(task.id)}
                    disabled={task.completed}
                    className={`h-8 rounded-[4px] px-3 text-xs font-medium font-generalSans border-2 ${
                      task.completed
                        ? 'border-success-lm/50 dark:border-success/45 bg-success-lm/15 dark:bg-success/20 text-success-lm dark:text-success hover:bg-success-lm/15 dark:hover:bg-success/20 shadow-none'
                        : 'border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] text-text dark:text-text-lm shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)] hover:opacity-90'
                    }`}
                  >
                    {task.completed ? 'Completed' : 'Mark Complete'}
                  </Button>
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
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[4px] text-danger-lm dark:text-danger hover:bg-danger-lm/10 dark:hover:bg-danger/15"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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

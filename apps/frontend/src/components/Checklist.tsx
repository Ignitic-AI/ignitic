'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { RefreshCw, Plus } from "lucide-react"

// Mock data for the checklist
const initialTasks = [
  {
    id: 1,
    text: "Get 100 Leads from Facebook",
    completed: true,
    priority: "high",
    icon: "green"
  },
  {
    id: 2,
    text: "Create Ads",
    completed: false,
    priority: "medium",
    icon: "red"
  },
  {
    id: 3,
    text: "Generate Report and Send",
    completed: false,
    priority: "high",
    icon: "red"
  },
  {
    id: 4,
    text: "Setup Email Automation",
    completed: false,
    priority: "low",
    icon: "red"
  },
  {
    id: 5,
    text: "Review Analytics Dashboard",
    completed: false,
    priority: "medium",
    icon: "red"
  }
]

export function Checklist() {
  const [tasks, setTasks] = useState(initialTasks)
  const [newTask, setNewTask] = useState('')

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ))
  }

  const addTask = () => {
    if (newTask.trim()) {
      const newTaskItem = {
        id: Date.now(),
        text: newTask.trim(),
        completed: false,
        priority: "medium" as const,
        icon: "red" as const
      }
      setTasks([...tasks, newTaskItem])
      setNewTask('')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-orange-600'
      case 'low': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getIconColor = (icon: string) => {
    return icon === 'green' ? 'text-green-500' : 'text-red-500'
  }

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-1">
        <CardTitle className="text-base font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent flex items-center gap-2 font-generalSans">
          TO DO LIST
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto p-1 hover:bg-slate-100 rounded-lg"
          >
            <RefreshCw className="w-3 h-3 text-slate-600" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Add new task */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add new task..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTask()}
            className="flex-1 px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium placeholder:text-slate-400"
          />
          <Button
            onClick={addTask}
            disabled={!newTask.trim()}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-2 py-1 rounded-lg transition-all duration-200 text-sm font-semibold shadow-md hover:shadow-lg"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {/* Task list */}
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {tasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all duration-200 ${
                task.completed 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => toggleTask(task.id)}
                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              />
              
              <span
                className={`flex-1 text-xs font-semibold ${
                  task.completed 
                    ? 'text-green-700 line-through' 
                    : 'text-slate-700'
                }`}
              >
                {task.text}
              </span>

              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  task.completed 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {task.priority}
                </span>
                
                <RefreshCw 
                  className={`w-3 h-3 ${getIconColor(task.icon)}`} 
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useState } from 'react'

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
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-slate-800">To-do List</h3>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      
      {/* Add new task */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Add new task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTask()}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white placeholder:text-slate-400"
        />
        <button
          onClick={addTask}
          disabled={!newTask.trim()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.slice(0, 4).map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              task.completed 
                ? 'bg-slate-50 border-slate-200' 
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              className="w-4 h-4 text-blue-500 border-slate-300 rounded focus:ring-blue-500"
            />
            
            <span
              className={`flex-1 text-sm ${
                task.completed 
                  ? 'text-slate-500 line-through' 
                  : 'text-slate-700'
              }`}
            >
              {task.text}
            </span>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                task.completed 
                  ? 'bg-slate-100 text-slate-500' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {task.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

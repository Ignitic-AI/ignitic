'use client'

import { useState } from 'react'

// Mock data for the checklist
const initialTasks = [
  {
    id: 1,
    text: "Get 100 Leads from Facebook",
    completed: true,
    priority: "high",
    icon: "📱",
    progress: 100,
    amount: "$2,450"
  },
  {
    id: 2,
    text: "Create Ads",
    completed: false,
    priority: "medium",
    icon: "📢",
    progress: 65,
    amount: "$1,890"
  },
  {
    id: 3,
    text: "Generate Report and Send",
    completed: false,
    priority: "high",
    icon: "📊",
    progress: 45,
    amount: "$3,120"
  },
  {
    id: 4,
    text: "Setup Email Automation",
    completed: false,
    priority: "low",
    icon: "✉️",
    progress: 30,
    amount: "$980"
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
        icon: "📝",
        progress: 0,
        amount: "$0"
      }
      setTasks([...tasks, newTaskItem])
      setNewTask('')
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
      
      {/* Add new task */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Add new task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTask()}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white placeholder:text-slate-400 hover:border-slate-300 transition-all duration-200"
        />
        <button
          onClick={addTask}
          disabled={!newTask.trim()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Task list */}
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
              
              {/* Checkbox */}
              <div className="flex-shrink-0">
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
      
      {/* View All Link */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <button className="w-full text-center text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors duration-200 hover:underline">
          View All Tasks
        </button>
      </div>
    </div>
  )
}

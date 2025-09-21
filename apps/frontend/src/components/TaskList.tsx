"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Calendar, User, Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

// MOCK DATA
const tasks = [
  {
    id: 1,
    name: "Complete project proposal",
    priority: "high",
    dueDate: "Tomorrow",
    status: "red",
    progress: 85,
    
    statusText: "In Review",
    startedDate: "28/04/2025",
  },
  {
    id: 2,
    name: "Review Q3 financial report",
    priority: "medium",
    dueDate: "Friday",
    status: "red",
    progress: 60,
    statusText: "In Progress",
    startedDate: "27/04/2025",
  },
  {
    id: 3,
    name: "Schedule team meeting",
    priority: "low",
    dueDate: "Monday",
    status: "blue",
    progress: 30,
   
    statusText: "To Do",
    startedDate: "26/04/2025",
  },
  {
    id: 4,
    name: "Onboard new client",
    priority: "high",
    dueDate: "Next Week",
    status: "blue",
    progress: 90,
    
    statusText: "Reviewed",
    startedDate: "25/04/2025",
  },
  {
    id: 5,
    name: "Update website content",
    priority: "medium",
    dueDate: "End of Month",
    status: "green",
    progress: 100,
    statusText: "Completed",
    startedDate: "24/04/2025",
  },
]

// Map status to Tailwind classes for background and custom shadow for glow effect
const statusLightClasses = {
  green: {
    bg: "bg-green-500",
    shadow: "shadow-[0_0_8px_rgba(34,197,94,0.7)]",
    containerBg: "bg-success/10",
    borderColor: "border-success/20",
  },
  blue: {
    bg: "bg-blue-500",
    shadow: "shadow-[0_0_8px_rgba(59,130,246,0.7)]",
    containerBg: "bg-info/10",
    borderColor: "border-info/20",
  },
  red: {
    bg: "bg-red-500",
    shadow: "shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    containerBg: "bg-danger/10",
    borderColor: "border-danger/20",
  },
}

const priorityColors = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-orange-100 text-orange-800 border-orange-200",
  low: "bg-yellow-100 text-yellow-800 border-yellow-200",
}

const statusColors = {
  "In Review": "bg-orange-100 text-orange-800",
  "In Progress": "bg-blue-100 text-blue-800",
  "To Do": "bg-gray-100 text-gray-800",
  Reviewed: "bg-purple-100 text-purple-800",
  Completed: "bg-green-100 text-green-800",
}

export default function TaskList() {
  return (
    <div className="flex-1 flex flex-col">
      <Card className="h-fit font-generalSans bg-bg-light border-1">
        <CardHeader className="-mb-2">
          <CardTitle className="text-2xl text-text flex items-center gap-2">
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.map((task) => {
            const lightClasses = statusLightClasses[task.status as keyof typeof statusLightClasses]
            return (
              <div
                key={task.id}
                className={`relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${lightClasses.containerBg} ${lightClasses.borderColor}`}
              >
                {/* Main Task Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text text-lg truncate">{task.name}</h3>
                  </div>

                  {/* Priority Badge */}
                  <Badge
                    variant="outline"
                    className={`ml-2 capitalize ${priorityColors[task.priority as keyof typeof priorityColors]}`}
                  >
                    {task.priority}
                  </Badge>

                  {/* Glowing Status Light */}
                  <div className={`ml-3 w-3 h-3 rounded-full ${lightClasses.bg} ${lightClasses.shadow}`} />
                </div>

                {/* Task Details Row */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    {/* Started Date */}
                    <div className="flex items-center gap-1 text-text-muted">
                      <Calendar className="h-4 w-4" />
                      <span>{task.startedDate}</span>
                    </div>

                    

                    {/* Due Date */}
                    <div className="text-text-muted">Due: {task.dueDate}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <Badge
                      variant="secondary"
                      className={`${statusColors[task.statusText as keyof typeof statusColors]}`}
                    >
                      {task.statusText}
                    </Badge>

                    {/* Progress */}
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress value={task.progress} className="h-2 flex-1" />
                      <span className="text-xs text-text-muted font-medium min-w-[35px]">{task.progress}%</span>
                    </div>

                    
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

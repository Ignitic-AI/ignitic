'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" 


// MOCK DATA
// Define task data with a status for the glowing light
const tasks = [
  { id: 1, name: "Complete project proposal", dueDate: "Due: Tomorrow", status: "red" },
  { id: 2, name: "Review Q3 financial report", dueDate: "Due: Friday", status: "red" },
  { id: 3, name: "Schedule team meeting", dueDate: "Due: Monday", status: "blue" },
  { id: 4, name: "Onboard new client", dueDate: "Due: Next Week", status: "blue" },
  { id: 5, name: "Update website content", dueDate: "Due: End of Month", status: "green" },
];

// Map status to Tailwind classes for background and custom shadow for glow effect
const statusLightClasses = {
  green: {
    bg: "bg-green-500",
    shadow: "shadow-[0_0_8px_rgba(34,197,94,0.7)]",
    containerBg: "bg-success",
  },
  blue: {
    bg: "bg-blue-500",
    shadow: "shadow-[0_0_8px_rgba(59,130,246,0.7)]",
    containerBg: "bg-info",
    //text-muted PREVIOUS VALUE for containerBg
  },
  red: {
    bg: "bg-red-500",
    shadow: "shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    containerBg: "bg-danger",
  },
};


export default function TaskList ()  {
  return (
    <div className="flex-1 flex flex-col">
            <Card className="h-fit font-generalSans bg-primary"> 
              <CardHeader>
                <CardTitle className="text-2xl -mb-4 -mt-2 text-text">Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 -mb-2">
                {tasks.map((task) => {
  const lightClasses = statusLightClasses[task.status as keyof typeof statusLightClasses];
  return (
    <div
      key={task.id}
      className={`flex items-center justify-between p-2 rounded-2xl text-text  ${lightClasses.containerBg}`}
    >
      <span className=" text-md pl-3 text-primary">{task.name}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-primary">{task.dueDate}</span>
        {/* Glowing Light */}
        <div
          className={`w-3 h-3 rounded-full ${lightClasses.bg} ${lightClasses.shadow}`}
        />
      </div>
    </div>
  );
})}

              </CardContent>
            </Card>
          </div>
  )
}

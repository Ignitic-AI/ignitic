import Workflows from "@/components/Workflows"
import TaskList from "@/components/TaskList"
import { Chatbar } from "@/components/ChatBar"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Chatbar />
      <Workflows />
      <TaskList />
    </div>
  )
}

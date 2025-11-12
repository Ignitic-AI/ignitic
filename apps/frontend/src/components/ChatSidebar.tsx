"use client"
import { Toggle } from "@/components/ui/toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Search } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// Add types for tool calls
type Tool = {
  name: string;
  description?: string;
  parameters?: any;
};

// Update component props
interface ChatSidebarProps {
  toolCalls?: Tool[];
}

const tools = [
  "Email Marketing",
  "Market Scraper",
  "SEO Analyzer",
  "Ad Optimizer",
]

const ChatSidebar = ({ toolCalls = [] }: ChatSidebarProps) => {
  const [showAll, setShowAll] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  console.log(toolCalls);

  

  const toggleTool = (tool: string) => {
  setSelectedTools((prev) =>
    prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
  )
}
  
    const visibleAgents = showAll ? tools : tools.slice(0, 2)
  return (
    <div className="w-80 bg-bg-lm dark:bg-bg border-l border-border-lm dark:border-border p-4 flex flex-col">
      {/* Tabs wrapper */}
      <Tabs defaultValue="agents" className="flex flex-col h-full">
        {/* Tab selector */}
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tool-calls">Tool Calls</TabsTrigger>
        </TabsList>

        {/* === Agents Tab === */}
        <TabsContent value="agents" className="flex-1">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#696a85]" />
              <Input
                placeholder="Search more agents"
                className="pl-10 bg-text border-border rounded-lg"
              />
            </div>
          </div>

          {/* Active Agents */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-lm dark:text-text">Active Agents (2)</h3>
            </div>

            <div className="space-y-2">
              {/* Marketing Agent */}
              <Card className="dark:bg-agent1-bg border-[#c987cc]">
                <CardHeader className="-m-3">
                  <CardTitle className="dark:text-agent1-h1 text-agent1 text-md font-semibold">
                    Marketing Agent
                  </CardTitle>
                  <CardDescription className="text-agent1  text-sm mb-2 -mt-1">
                    An expert in making market automations and analyzing trends
                  </CardDescription>
                </CardHeader>
                <CardContent className="-m-3 py-1">
                  <div className="flex justify-between text-xs dark:text-info text-info-lm">
                    <span>Last Active: 2h ago</span>
                    <span>Active Tasks: 3</span>
                  </div>
                </CardContent>
              </Card>

              {/* Tools */}
              <div className="flex flex-wrap gap-2">
                {visibleAgents.map((tool, idx) => (
                  <Toggle
                    key={idx}
                    onClick={() => toggleTool(tool)}
                    pressed={selectedTools.includes(tool)}
                    className="rounded-full border border-[#c987cc] dark:bg-agent1-bg bg-agent1-bg-lm 
                              px-4 py-2 text-sm  text-agent1
                              data-[state=on]:bg-success data-[state=on]:text-white data-[state=on]:border-green-400"
                    aria-label={`Toggle ${tool}`}
                  >
                    {tool}
                  </Toggle>
                ))}

                {tools.length > 2 && (
                  showAll ? (
                    <Button
                      variant="link"
                      size="sm"
                      className=" text-agent1   px-4 py-2 text-sm"
                      onClick={() => setShowAll(false)}
                    >
                      Hide
                    </Button>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      className=" text-agent1     px-4 py-2 text-sm"
                      onClick={() => setShowAll(true)}
                    >
                      Show All
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* === Tool Calls Tab === */}
        <TabsContent value="tool-calls" className="flex-1">
          <h3 className="font-semibold text-bg mb-4 dark:text-white">Recent Tool Calls</h3>
          <div className="space-y-2 text-sm">
            {toolCalls.length === 0 ? (
              <p className="text-text-lm dark:text-text">No recent tool calls.</p>
            ) : (
              toolCalls.map((call, index) => (
                <div key={index} className="p-3 border rounded-lg hover:bg-muted cursor-pointer">
                  <strong>{call.name}</strong>
                  {call.description && <p className="text-xs text-text-lm dark:text-text">{call.description}</p>}
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ChatSidebar
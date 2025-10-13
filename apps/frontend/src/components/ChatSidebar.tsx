"use client"
import { Toggle } from "@/components/ui/toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Search } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"


const tools = [
  "Email Marketing",
  "Market Scraper",
  "SEO Analyzer",
  "Ad Optimizer",
]

const ChatSidebar = () => {
  const [showAll, setShowAll] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  

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
              <Card className="bg-agent1-bg border-[#c987cc]">
                <CardHeader className="-m-3">
                  <CardTitle className="text-agent1 text-sm font-semibold">
                    Marketing Agent
                  </CardTitle>
                  <CardDescription className="text-agent1 text-xs mb-2 -mt-1">
                    An expert in making market automations and analyzing trends
                  </CardDescription>
                </CardHeader>
                <CardContent className="-m-3 py-1">
                  <div className="flex justify-between text-xs text-agent1">
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
                    className="rounded-full border border-[#c987cc] bg-agent1-bg-light 
                              px-4 py-2 text-sm text-agent1
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
                      className=" text-agent1 px-4 py-2 text-sm"
                      onClick={() => setShowAll(false)}
                    >
                      Hide
                    </Button>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      className=" text-agent1 px-4 py-2 text-sm"
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
          <h3 className="font-semibold text-bg mb-4">Recent Tool Calls</h3>
          <div className="space-y-2 text-sm">
            <div className="p-3 border rounded-lg hover:bg-muted cursor-pointer">
              📊 SEO Analyzer → "Analyze homepage keywords"
              <div className="text-xs text-muted-foreground">2 min ago</div>
            </div>
            <div className="p-3 border rounded-lg hover:bg-muted cursor-pointer">
              📢 Ad Manager → "Launch summer campaign"
              <div className="text-xs text-muted-foreground">15 min ago</div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ChatSidebar
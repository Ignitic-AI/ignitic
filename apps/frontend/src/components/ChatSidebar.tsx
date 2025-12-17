"use client"
import { Toggle } from "@/components/ui/toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { Search, ChevronUp, ChevronDown } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useSession } from "next-auth/react"
import axios from "axios"
import { Spinner } from "@/components/ui/spinner"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar"

// Add types for tool calls
type ToolCall = {
  name: string;
  description?: string;
  parameters?: any;
};

// Types for Agent API response
type AgentTool = {
  name: string;
  description: string;
};

type Agent = {
  identifier: string;
  name: string;
  tools: AgentTool[];
};

// Update component props
interface ChatSidebarProps {
  toolCalls?: ToolCall[];
  isOpen?: boolean;
}

const ChatSidebar = ({ toolCalls = [], isOpen = false }: ChatSidebarProps) => {
  const { data: session } = useSession();
  const [showAllTools, setShowAllTools] = useState<Record<string, boolean>>({});
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      if (!session?.user?.token) return;

      try {
        setIsLoading(true);
        const response = await axios.get("http://localhost:8080/api/v1/agents/", {
          headers: {
            Authorization: `Bearer ${session.user.token}`,
          },
        });
        setAgents(response.data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch agents:", err);
        setError("Failed to load agents");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [session?.user?.token]);

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    )
  }

  const toggleShowAll = (agentId: string) => {
    setShowAllTools(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
  }
  
  if (!isOpen) return null;

  return (
    <Sidebar side="right" collapsible="none" className="w-80 border-l border-border-lm dark:border-border bg-bg-lm dark:bg-bg overflow-hidden transition-all duration-300">
      <Tabs defaultValue="agents" className="flex flex-col h-full w-full">
        <SidebarHeader className="p-4 pb-0 shrink-0">
          {/* Tab selector */}
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="tool-calls">Tool Calls</TabsTrigger>
          </TabsList>
        </SidebarHeader>

        <SidebarContent className="p-4 pt-0 scrollbar-hide">
          {/* === Agents Tab === */}
          <TabsContent value="agents" className="m-0 border-0 h-full outline-none">
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
                <h3 className="font-semibold text-text-lm dark:text-text">
                  Active Agents ({agents.length})
                </h3>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : error ? (
                <div className="text-red-500 text-sm text-center">{error}</div>
              ) : (
                <div className="space-y-6">
                  {agents.map((agent) => {
                    const isExpanded = showAllTools[agent.identifier];
                    const visibleTools = isExpanded ? agent.tools : agent.tools.slice(0, 3);
                    
                    // Determine card styling based on agent (cycling colors or specific logic if needed)
                    // For now, using the same style as the original "Marketing Agent"
                    const cardBorderColor = agent.identifier === 'marketer' ? 'border-[#c987cc]' : 'border-blue-300';
                    const titleColor = agent.identifier === 'marketer' ? 'text-agent1 dark:text-agent1-h1' : 'text-blue-600 dark:text-blue-400';
                    const badgeBg = agent.identifier === 'marketer' ? 'bg-agent1-bg-lm dark:bg-agent1-bg' : 'bg-blue-50 dark:bg-blue-900/20';
                    const badgeText = agent.identifier === 'marketer' ? 'text-agent1' : 'text-blue-600 dark:text-blue-300';
                    const badgeBorder = agent.identifier === 'marketer' ? 'border-[#c987cc]' : 'border-blue-200 dark:border-blue-800';

                    return (
                      <div key={agent.identifier} className="space-y-2">
                        <Card className={`dark:bg-transparent ${cardBorderColor}`}>
                          <CardHeader className="-m-3">
                            <CardTitle className={`${titleColor} text-md font-semibold`}>
                              {agent.name}
                            </CardTitle>
                            <CardDescription className={`${titleColor} opacity-80 text-sm mb-2 -mt-1 line-clamp-2`}>
                              {agent.identifier === 'product_researcher' 
                                ? "Specializes in finding products and analyzing market trends." 
                                : agent.identifier === 'marketer'
                                ? "An expert in making market automations and analyzing trends"
                                : "AI Agent specialized in specific tasks."}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="-m-3 py-1">
                            <div className="flex justify-between text-xs dark:text-info text-info-lm">
                              <span>Last Active: 2h ago</span>
                              <span>Active Tasks: {Math.floor(Math.random() * 5)}</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Tools */}
                        <div className="flex flex-wrap gap-2">
                          {visibleTools.map((tool, idx) => (
                            <Toggle
                              key={`${agent.identifier}-${tool.name}-${idx}`}
                              onClick={() => toggleTool(tool.name)}
                              pressed={selectedTools.includes(tool.name)}
                              className={`rounded-full border ${badgeBorder} ${badgeBg} 
                                        px-4 py-2 text-sm ${badgeText}
                                        data-[state=on]:bg-success data-[state=on]:text-white data-[state=on]:border-green-400`}
                              aria-label={`Toggle ${tool.name}`}
                              title={tool.description}
                            >
                              {tool.name.replace(/_/g, ' ')}
                            </Toggle>
                          ))}

                          {agent.tools.length > 3 && (
                            <Button
                              variant="link"
                              size="sm"
                              className={`${badgeText} px-4 py-2 text-sm`}
                              onClick={() => toggleShowAll(agent.identifier)}
                            >
                              {isExpanded ? (
                                <span className="flex items-center">
                                  Hide <ChevronUp className="ml-1 h-3 w-3" />
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  Show All <ChevronDown className="ml-1 h-3 w-3" />
                                </span>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === Tool Calls Tab === */}
          <TabsContent value="tool-calls" className="m-0 border-0 h-full outline-none">
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
        </SidebarContent>
      </Tabs>
    </Sidebar>
  )
}

export default ChatSidebar
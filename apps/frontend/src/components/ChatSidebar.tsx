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
import { useOrgStore } from "@/app/_store/useorgStore"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { API_V1_BASE_URL } from "@/lib/api"

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

type ToolCallsScope = "personal" | "org" | "all";

type ToolExecution = {
  id: string;
  tool_name: string;
  ignitic_identifier: string;
  chat_id?: string | null;
  status: "running" | "succeeded" | "failed";
  created_at: string;
  updated_at: string;
  error?: string | null;
};

type ToolCallsResponse = {
  executions: ToolExecution[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

// Update component props
interface ChatSidebarProps {
  toolCalls?: ToolCall[];
  isOpen?: boolean;
}

const ChatSidebar = ({ toolCalls = [], isOpen = false }: ChatSidebarProps) => {
  const { data: session } = useSession();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const organizationId = currentOrg?.id ?? null;
  const [showAllTools, setShowAllTools] = useState<Record<string, boolean>>({});
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"agents" | "tool-calls">("agents");
  const [selectedAgentIdentifier, setSelectedAgentIdentifier] = useState<string>("");
  const [toolCallsScope, setToolCallsScope] = useState<ToolCallsScope>(
    organizationId ? "org" : "personal"
  );
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [isToolCallsLoading, setIsToolCallsLoading] = useState(false);
  const [toolCallsError, setToolCallsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      if (!session?.user?.token) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${API_V1_BASE_URL}/agents/`, {
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

  useEffect(() => {
    if (organizationId) {
      setToolCallsScope("org");
    } else if (toolCallsScope === "org") {
      setToolCallsScope("personal");
    }
  }, [organizationId, toolCallsScope]);

  useEffect(() => {
    if (!agents.length) {
      setSelectedAgentIdentifier("");
      return;
    }
    if (!selectedAgentIdentifier || !agents.some((a) => a.identifier === selectedAgentIdentifier)) {
      setSelectedAgentIdentifier(agents[0].identifier);
    }
  }, [agents, selectedAgentIdentifier]);

  useEffect(() => {
    const fetchToolExecutions = async () => {
      if (!session?.user?.token || !selectedAgentIdentifier || activeTab !== "tool-calls") return;

      const effectiveScope: ToolCallsScope =
        toolCallsScope === "org" && !organizationId ? "personal" : toolCallsScope;

      try {
        setIsToolCallsLoading(true);
        const response = await axios.get<ToolCallsResponse>(
          `${API_V1_BASE_URL}/agents/${selectedAgentIdentifier}/tool-calls`,
          {
            headers: {
              Authorization: `Bearer ${session.user.token}`,
            },
            params: {
              scope: effectiveScope,
              page: 1,
              page_size: 50,
              organization_id: organizationId || undefined,
            },
          }
        );
        setToolExecutions(response.data.executions || []);
        setToolCallsError(null);
      } catch (err) {
        console.error("Failed to fetch tool calls:", err);
        setToolCallsError("Failed to load tool calls");
      } finally {
        setIsToolCallsLoading(false);
      }
    };

    fetchToolExecutions();
  }, [session?.user?.token, selectedAgentIdentifier, activeTab, toolCallsScope, organizationId]);

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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "agents" | "tool-calls")} className="flex flex-col h-full w-full">
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
                  {agents.map((agent, agentIndex) => {
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
                      <div key={`${agent.identifier}-${agentIndex}`} className="space-y-2">
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
                          {visibleTools.map((tool, toolIdx) => (
                            <Toggle
                              key={`${agent.identifier}-${agentIndex}-tool-${toolIdx}-${tool.name}`}
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
            <div className="space-y-3 mb-4">
              <select
                value={selectedAgentIdentifier}
                onChange={(e) => setSelectedAgentIdentifier(e.target.value)}
                className="w-full rounded-md border border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light px-3 py-2 text-sm text-text-lm dark:text-text"
              >
                {agents.map((agent, optIdx) => (
                  <option key={`${agent.identifier}-${optIdx}`} value={agent.identifier}>
                    {agent.name}
                  </option>
                ))}
              </select>

              <div className="flex rounded-full p-1 backdrop-blur-md bg-white/20 dark:bg-white/10 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-7 px-3 text-xs flex-1 rounded-full transition-colors ${
                    toolCallsScope === "org"
                      ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                      : "bg-transparent text-text-muted-lm dark:text-text-muted"
                  }`}
                  onClick={() => setToolCallsScope("org")}
                  disabled={!organizationId}
                >
                  Current Org
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-7 px-3 text-xs flex-1 rounded-full transition-colors ${
                    toolCallsScope === "all"
                      ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                      : "bg-transparent text-text-muted-lm dark:text-text-muted"
                  }`}
                  onClick={() => setToolCallsScope("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-7 px-3 text-xs flex-1 rounded-full transition-colors ${
                    toolCallsScope === "personal"
                      ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                      : "bg-transparent text-text-muted-lm dark:text-text-muted"
                  }`}
                  onClick={() => setToolCallsScope("personal")}
                >
                  Personal
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {isToolCallsLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : toolCallsError ? (
                <p className="text-red-500">{toolCallsError}</p>
              ) : toolExecutions.length > 0 ? (
                toolExecutions.map((execution, execIdx) => (
                  <div
                    key={`tool-exec-${execIdx}-${execution.id}-${execution.created_at}`}
                    className="p-3 border rounded-lg hover:bg-muted"
                  >
                    <strong>{execution.tool_name}</strong>
                    <p className="text-xs text-text-lm dark:text-text mt-1">
                      {execution.status} • {new Date(execution.created_at).toLocaleString()}
                    </p>
                    {execution.error && (
                      <p className="text-xs text-red-500 mt-1 truncate">{execution.error}</p>
                    )}
                  </div>
                ))
              ) : toolCalls.length === 0 ? (
                <p className="text-text-lm dark:text-text">No recent tool calls.</p>
              ) : (
                toolCalls.map((call, index) => (
                  <div
                    key={`prop-tool-${index}-${call.name}`}
                    className="p-3 border rounded-lg hover:bg-muted cursor-pointer"
                  >
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

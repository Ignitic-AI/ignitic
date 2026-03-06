'use client'
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useSession, signIn } from "next-auth/react";
import { LoadingLogo } from "@/components/Loading"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, PlusCircle, XCircle, Lock, CheckCircle2, Bot, Wrench, Sparkles, ChevronRight, LayoutGrid, Network } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentsGraphView } from "@/components/agents/AgentsGraphView";

interface Tool {
  name: string;
  description: string;
}
interface Agent {
  identifier: string;
  name: string;
  type?: string;
  parent?: string;
  tools: Tool[];
}
// Function to format the agent name
// like my_agent -> My Agent
const formatAgentName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};
export default function AgentToolSelector() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signup");
    }
  }, [status, router]);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'graph'>('cards');
  
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await axios.get("http://localhost:8080/api/v1/agents/", {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
            "Content-Type": "application/json",
          },
        });
        setAgents(response.data);
       
        // Select the first agent by default
        if (response.data.length > 0) {
          setSelectedAgents([response.data[0].name]);
        }
      } catch (err: any) {
        console.error("Failed to fetch agents:", err);
        setError(err.response?.data?.message || "Failed to load agents");
      } finally {
        setLoading(false);
      }
    };
    if (session?.user?.token) {
      fetchAgents();
    }
  }, [session?.user?.token]);

  function getAgentColor(name: string): string {
    const colors = [
      "from-blue-500 to-cyan-500",
      "from-purple-500 to-pink-500",
      "from-green-500 to-emerald-500",
      "from-orange-500 to-amber-500",
      "from-red-500 to-rose-500",
      "from-indigo-500 to-blue-500",
    ]
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[index % colors.length]
  }

  function getToolColor(name: string): string {
    const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-cyan-500", "bg-pink-500"]
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[index % colors.length]
  }

  const handleFilterChange = (value: string) => {
    if (value === "select-all") {
      setSelectedAgents(agents.map(agent => agent.name));
    } else if (value === "deselect-all") {
      setSelectedAgents([]);
    } else {
      // Individual agent selection
      setSelectedAgents([value]);
    }
  };

  if (loading || status === "unauthenticated") {
    return (
      <LoadingLogo/>
    );
  }
  if (error) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
 
  // Find all currently selected agent objects
  const currentlySelectedAgents = agents.filter((a) => selectedAgents.includes(a.name));
  // Combine tools from all selected agents (and deduplicate them by name)
  const combinedTools: Tool[] = currentlySelectedAgents.reduce((acc: Tool[], agent) => {
    agent.tools.forEach(tool => {
      // Only add the tool if it's not already in the accumulator
      if (!acc.some(existingTool => existingTool.name === tool.name)) {
        acc.push(tool);
      }
    });
    return acc;
  }, []);
  return (
    <div className={`font-generalSans ${viewMode === 'graph' ? 'flex flex-1 flex-col min-h-0' : 'min-h-screen bg-gradient-to-br from-background via-background to-muted/20'}`}>
      {viewMode === 'graph' ? (
        <>
          {/* Graph mode: full-width from sidebar to page edge */}
          <div className="shrink-0 px-6 lg:px-8 py-4 border-b border-border flex items-center justify-between bg-background">
            <div className="flex items-center gap-2">
              <Label className="text-lg font-semibold">Agent & Tool Hierarchy</Label>
              <span className="text-sm text-muted-foreground">({agents.length} agents, {agents.reduce((acc, a) => acc + a.tools.length, 0)} tools)</span>
            </div>
            <div className="flex rounded-lg border border-border bg-bg-light/50 p-1">
              <button
                onClick={() => setViewMode('cards')}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground"
              >
                <Network className="h-4 w-4" />
                Graph
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <AgentsGraphView agents={agents} fullPage />
          </div>
        </>
      ) : (
        <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-generalSans font-bold tracking-tight text-balance">Agent & Tool Manager</h1>
              <p className="text-muted-foreground font-generalSans text-pretty max-w-2xl mt-1">
                Select agents to view their available tools and capabilities. Build powerful automations by combining
                multiple agents.
              </p>
            </div>
            <div className="flex rounded-lg border border-border bg-bg-light/50 p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'graph' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Network className="h-4 w-4" />
                Graph
              </button>
            </div>
          </div>
        </div>
        <>
        {/* Agent Selection Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-lg font-semibold">Available Agents</Label>
              {selectedAgents.length > 0 && (
                <span className="text-sm text-muted-foreground">({selectedAgents.length} selected)</span>
              )}
            </div>
            
            <Select onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select-all">Select All</SelectItem>
                <SelectItem value="deselect-all">Deselect All</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.name} value={agent.name}>
                    {formatAgentName(agent.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const formattedName = formatAgentName(agent.name)
              const firstLetter = formattedName[0].toUpperCase()
              const gradientColor = getAgentColor(agent.name)

              return (
                <Card
                  key={agent.identifier}
                  className="transition-all duration-200 hover:scale-[1.02] group overflow-hidden cursor-pointer"
                  onClick={() => router.push(`/agents_and_tools/${agent.identifier}`)}
                >
                  <CardContent className="flex items-center gap-3 px-4 py-2">
                    {/* Agent Logo Circle */}
                    <div
                      className={`h-12 w-12 rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg`}
                    >
                      {firstLetter}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{formattedName}</p>
                      <p className="text-xs text-muted-foreground">{agent.tools.length} tools</p>
                    </div>

                    <div>
                      <ChevronRight className="h-7 w-7 text-muted-foreground transition-colors duration-300" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Tools Display Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            
            <h2 className="text-xl font-semibold">
              {selectedAgents.length === 0 ? (
                "Available Tools"
              ) : (
                <>
                  Tools from{" "}
                  <span className="text-primary">
                    {selectedAgents.length === 1
                      ? formatAgentName(selectedAgents[0])
                      : `${selectedAgents.length} Agents`}
                  </span>
                </>
              )}
            </h2>
            {combinedTools.length > 0 && (
              <span className="text-sm text-muted-foreground">({combinedTools.length} total)</span>
            )}
          </div>

          {selectedAgents.length > 0 && combinedTools.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {combinedTools.map((tool) => {
                const toolColor = getToolColor(tool.name)
                const firstLetter = tool.name[0].toUpperCase()

                return (
                  <Card
                    key={tool.name}
                    className="border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-lg group"
                  >
                    <CardHeader className="pb-3 border-b border-border/30">
                      <div className="flex items-center gap-3">
                        {/* Tool Logo Circle */}
                        <div
                          className={`h-10 w-10 rounded-full ${toolColor} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md group-hover:scale-110 transition-transform`}
                        >
                          {firstLetter}
                        </div>
                        <CardTitle className="text-base font-semibold tracking-tight text-balance flex-1">
                          {tool.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{tool.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : selectedAgents.length > 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Selected agents have no assigned tools.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Bot className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground mb-2 font-medium">No agents selected</p>
                <p className="text-sm text-muted-foreground/70">
                  Select one or more agents above to view their available tools
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        </>
        </div>
      )}
    </div>
  );
}
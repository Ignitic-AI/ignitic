'use client'

import { useState, useEffect } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { LoadingLogo } from "@/components/Loading"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, PlusCircle, XCircle } from "lucide-react"; 
import { ScrollArea } from "@/components/ui/scroll-area"; // ScrollArea is no longer necessary for Agent List but kept for potential future use

interface Tool {
  name: string;
  description: string;
}

interface Agent {
  name: string;
  tools: Tool[];
}

// Function to format the agent name 
// like my_agent -> My Agent
const formatAgentName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function AgentToolSelector() {
  const { data: session } = useSession();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

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

  
  const handleAgentToggle = (agentName: string) => {
    setSelectedAgents((prevSelected) => {
      if (prevSelected.includes(agentName)) {
        // Deselect: remove the agent
        return prevSelected.filter((name) => name !== agentName);
      } else {
        // Select: add the agent
        return [...prevSelected, agentName];
      }
    });
  };

  if (loading) {
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
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-generalSans font-bold">Agent and Tool Viewer</h1>
      
      {/* Agent List - Now a Grid */}
      <div className="space-y-3">
        <Label className="block font-generalSans text-lg font-semibold">
          Select Agents 
        </Label>
        
        {/* REPLACED ScrollArea with a div for the grid layout */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"> 
          {agents.length > 0 ? (
            agents.map((agent) => {
              const isSelected = selectedAgents.includes(agent.name);
              return (
                <Card
                  key={agent.name}
                  onClick={() => handleAgentToggle(agent.name)}
                  // The w-full is implied by the grid column structure
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "hover:border-primary/50"
                  }`}
                >
                  <CardContent className="flex items-center justify-center "> {/* Added padding for consistency */}
                    <p className="font-generalSans font-medium truncate">
                      {formatAgentName(agent.name)}
                    </p>
                    {isSelected ? (
                      <CheckCircle className="h-5 w-5 text-primary ml-4" />
                    ) : (
                      <PlusCircle className="h-5 w-5 text-muted-foreground/70 ml-4" />
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-muted-foreground italic font-generalSans p-4 col-span-3">No agents found.</p>
          )}
        </div>
      </div>
      
      {/* Tools List - Displays tools from ALL selected agents */}
      <div className="w-full pt-4">
        <h2 className="text-xl font-generalSans font-semibold mb-4">
          Available Tools for{" "}
          <span className="text-primary font-semibold">
            {selectedAgents.length === 0 
                ? "No Agents Selected"
                : selectedAgents.length === 1 
                ? formatAgentName(selectedAgents[0])
                : `${selectedAgents.length} Agents Combined`}
          </span>
        </h2>

        {selectedAgents.length > 0 && combinedTools.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {combinedTools.map((tool) => (
              <Card key={tool.name} className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-primary font-generalSans font-medium">
                    {tool.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-generalSans">
                    {tool.description.trim()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : selectedAgents.length > 0 ? (
           <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground italic font-generalSans">Selected agents have no assigned tools.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground italic font-generalSans">Please select one or more agents from the list above.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
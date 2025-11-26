'use client'

import { useState, useEffect } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";

// shadcn components
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface Tool {
  name: string;
  description: string;
}

interface Agent {
  name: string;
  tools: Tool[];
}

export default function AgentToolSelector() {
  const { data: session } = useSession();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

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
        if (response.data.length > 0) {
          setSelectedAgent(response.data[0].name);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
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

  const currentAgent = agents.find((a) => a.name === selectedAgent);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Agent Selector */}
      <div>
        <Label className="mb-3 block font-generalSans">Select Agent</Label>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-full font-generalSans bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border">
            <SelectValue placeholder="Select an agent" className="font-generalSans opacity-70"/>
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.name} value={agent.name} className="font-generalSans">
                {agent.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tools List */}
      <div>
        <h2 className="text-xl font-generalSans mb-4">
          Available Tools for{" "}
          <span className="text-primary font-generalSans font-semibold">
            {selectedAgent.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </span>
        </h2>

        {currentAgent && currentAgent.tools.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {currentAgent.tools.map((tool) => (
              <Card key={tool.name} className="border shadow-sm hover:shadow-md transition">
                <CardHeader>
                  <CardTitle className=" text-sm text-primary font-generalSans">
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
        ) : (
          <p className="text-muted-foreground italic font-generalSans">No tools available for this agent.</p>
        )}
      </div>
    </div>
  );
}

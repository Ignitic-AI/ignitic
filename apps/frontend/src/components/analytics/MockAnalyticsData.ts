export const MOCK_ANALYTICS_DATA: Record<string, any> = {
  agent_runs: {
    label: "Agent Runs",
    data: [
      { name: "Mon", value: 120 },
      { name: "Tue", value: 145 },
      { name: "Wed", value: 132 },
      { name: "Thu", value: 180 },
      { name: "Fri", value: 240 },
      { name: "Sat", value: 150 },
      { name: "Sun", value: 110 },
    ],
    color: "hsl(var(--chart-1))"
  },
  revenue: {
    label: "Revenue",
    data: [
      { name: "Jan", value: 12000 },
      { name: "Feb", value: 15000 },
      { name: "Mar", value: 18000 },
      { name: "Apr", value: 14000 },
      { name: "May", value: 21000 },
      { name: "Jun", value: 25000 },
    ],
    color: "hsl(var(--chart-2))"
  },
  traffic: {
    label: "Traffic",
    data: [
      { name: "00:00", value: 30 },
      { name: "04:00", value: 15 },
      { name: "08:00", value: 450 },
      { name: "12:00", value: 1200 },
      { name: "16:00", value: 980 },
      { name: "20:00", value: 340 },
    ],
    color: "hsl(var(--chart-3))"
  },
  users: {
    label: "Active Users",
    data: [
      { name: "North", value: 400 },
      { name: "South", value: 300 },
      { name: "East", value: 550 },
      { name: "West", value: 480 },
    ],
    color: "hsl(var(--chart-4))"
  },
  tokens: {
    label: "Token Usage",
    data: [
      { name: "GPT-4", value: 45000, fill: "hsl(var(--chart-1))" },
      { name: "Claude 3", value: 35000, fill: "hsl(var(--chart-2))" },
      { name: "Llama 3", value: 20000, fill: "hsl(var(--chart-3))" },
      { name: "Mistral", value: 15000, fill: "hsl(var(--chart-4))" },
    ],
    color: "hsl(var(--chart-5))"
  }
}

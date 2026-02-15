"use client"

import { Bar, BarChart, Line, LineChart, Pie, PieChart, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// Generic Props

export interface ChartDataPoint {
  name: string
  value: number
  fill?: string
}

export interface GenericChartProps {
  data: ChartDataPoint[]
  label: string
  color?: string
}

// Chart Configs
const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

// Components 

export function GenericBarChart({ data, label, color = "var(--primary)" }: GenericChartProps) {
  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground">
          {data.reduce((acc, curr) => acc + curr.value, 0).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-4rem)]">
        <ChartContainer config={chartConfig} className="h-full w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function GenericAreaChart({ data, label, color = "var(--primary)" }: GenericChartProps) {
  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground">
          {data.reduce((acc, curr) => acc + curr.value, 0).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-4rem)]">
        <ChartContainer config={chartConfig} className="h-full w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="value"
                type="natural"
                fill="url(#fillValue)"
                stroke={color}
                fillOpacity={0.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function GenericLineChart({ data, label, color = "var(--primary)" }: GenericChartProps) {
  return (
     <Card className="h-full border-none shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground">
           {data.reduce((acc, curr) => acc + curr.value, 0).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-4rem)]">
        <ChartContainer config={chartConfig} className="h-full w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="value"
                type="monotone"
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function GenericPieChart({ data, label, color = "var(--primary)" }: GenericChartProps) {
    // Generate distinct colors for pie slices if not provided
    const pieData = data.map((d, i) => ({
        ...d,
        fill: d.fill || `hsl(var(--chart-${(i % 5) + 1}))`
    }))

  return (
    <Card className="h-full border-none shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground">
          Distribution
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-4rem)]">
        <ChartContainer config={chartConfig} className="h-full w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

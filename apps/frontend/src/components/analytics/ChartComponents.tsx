"use client"

import { Bar, BarChart, Line, LineChart, Pie, PieChart, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
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
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

// Components 

export function GenericBarChart({ data, label, color = "hsl(var(--chart-1))" }: GenericChartProps) {
  return (
    <Card className="h-full border-none shadow-none bg-transparent py-0 gap-0">
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

export function GenericAreaChart({ data, label, color = "hsl(var(--chart-1))" }: GenericChartProps) {
  return (
    <Card className="h-full border-none shadow-none bg-transparent py-0 gap-0">
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
                strokeWidth={2.5}
                fillOpacity={0.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function GenericLineChart({ data, label, color = "hsl(var(--chart-1))" }: GenericChartProps) {
  return (
     <Card className="h-full border-none shadow-none bg-transparent py-0 gap-0">
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
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function GenericPieChart({ data, label, color = "hsl(var(--chart-1))" }: GenericChartProps) {
    // Generate distinct colors for pie slices if not provided
    const pieData = data.map((d, i) => ({
        ...d,
        fill: d.fill || `hsl(var(--chart-${(i % 5) + 1}))`
    }))

  return (
    <Card className="h-full border-none shadow-none bg-transparent py-0 gap-0">
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


// ──────────────────────────────────────────────
// Token-specific multi-series chart components
// ──────────────────────────────────────────────

export interface TokenDataPoint {
  name: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export type TokenMetricKey = 'input_tokens' | 'output_tokens' | 'total_tokens'

export interface TokenChartProps {
  data: TokenDataPoint[]
  label: string
  selectedMetrics?: TokenMetricKey[]
}

const ALL_METRICS: TokenMetricKey[] = ['input_tokens', 'output_tokens', 'total_tokens']

const METRIC_META: Record<TokenMetricKey, { name: string; color: string; chartVar: string }> = {
  input_tokens: { name: 'Input', color: 'hsl(var(--chart-1))', chartVar: '--chart-1' },
  output_tokens: { name: 'Output', color: 'hsl(var(--chart-2))', chartVar: '--chart-2' },
  total_tokens: { name: 'Total', color: 'hsl(var(--chart-3))', chartVar: '--chart-3' },
}

const tokenChartConfig = {
  input_tokens: {
    label: "Input Tokens",
    color: "hsl(var(--chart-1))",
  },
  output_tokens: {
    label: "Output Tokens",
    color: "hsl(var(--chart-2))",
  },
  total_tokens: {
    label: "Total Tokens",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export function TokenBarChart({ data, label, selectedMetrics }: TokenChartProps) {
  const metrics = selectedMetrics?.length ? selectedMetrics : ALL_METRICS
  const summaryKey = metrics.includes('total_tokens') ? 'total_tokens' : metrics[0]
  const total = data.reduce((acc, curr) => acc + curr[summaryKey], 0)

  return (
    <Card className="h-full border-none shadow-none bg-transparent py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground font-generalSans">{label}</CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground font-generalSans">
          {total.toLocaleString()} tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-4rem)]">
        <ChartContainer config={tokenChartConfig} className="h-full w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={9} angle={-20} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {metrics.map((m) => (
                <Bar key={m} dataKey={m} name={METRIC_META[m].name} fill={METRIC_META[m].color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function TokenLineChart({ data, label, selectedMetrics }: TokenChartProps) {
  const metrics = selectedMetrics?.length ? selectedMetrics : ALL_METRICS
  const summaryKey = metrics.includes('total_tokens') ? 'total_tokens' : metrics[0]
  const total = data.reduce((acc, curr) => acc + curr[summaryKey], 0)

  return (
    <Card className="h-full border-none shadow-none bg-transparent py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground font-generalSans">{label}</CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground font-generalSans">
          {total.toLocaleString()} tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-4rem)]">
        <ChartContainer config={tokenChartConfig} className="h-full w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={9} angle={-20} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {metrics.map((m) => (
                <Line key={m} dataKey={m} name={METRIC_META[m].name} type="monotone" stroke={METRIC_META[m].color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const GRADIENT_IDS: Record<TokenMetricKey, string> = {
  input_tokens: 'fillInput',
  output_tokens: 'fillOutput',
  total_tokens: 'fillTotal',
}

export function TokenAreaChart({ data, label, selectedMetrics }: TokenChartProps) {
  const metrics = selectedMetrics?.length ? selectedMetrics : ALL_METRICS
  const summaryKey = metrics.includes('total_tokens') ? 'total_tokens' : metrics[0]
  const total = data.reduce((acc, curr) => acc + curr[summaryKey], 0)

  return (
    <Card className="h-full border-none shadow-none bg-transparent py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground font-generalSans">{label}</CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground font-generalSans">
          {total.toLocaleString()} tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 h-[calc(100%-4rem)]">
        <ChartContainer config={tokenChartConfig} className="h-full w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                {metrics.map((m) => (
                  <linearGradient key={m} id={GRADIENT_IDS[m]} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={METRIC_META[m].color} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={METRIC_META[m].color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} fontSize={9} angle={-20} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {metrics.map((m) => (
                <Area key={m} dataKey={m} name={METRIC_META[m].name} type="natural" fill={`url(#${GRADIENT_IDS[m]})`} stroke={METRIC_META[m].color} fillOpacity={0.4} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

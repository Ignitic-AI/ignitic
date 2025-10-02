"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ChevronRight, PlayCircle, Info,  Filter } from "lucide-react"
import { useRouter } from "next/navigation";
import { Variants } from "framer-motion";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type Category = "All" | "Sales" | "Facebook" | "CRM" | "Product" | "Emails"

const categoryColors = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-pink-100 text-pink-800",
  "bg-yellow-100 text-yellow-800",
  "bg-purple-100 text-purple-800",
];

type Agent = {
  id: string
  name: string
  description: string
  categories: Category[]
}

type Tool = {
  id: string
  name: string
  by: string
  description?: string
  categories: Category[]
  brand?: string
}

const categories: Category[] = ["All", "Sales", "Facebook", "CRM", "Product", "Emails"]

const AGENTS: Agent[] = [
  {
    id: "a1",
    name: "Lead Hunter",
    description: "Find and qualify leads across the web.",
    categories: ["Sales", "CRM"],
  },
  { id: "a2", name: "Inbox Helper", description: "Draft and triage customer emails.", categories: ["Emails", "Sales"] },
  { id: "a3", name: "Page Insights", description: "Analyze product pages for conversion.", categories: ["Product"] },
  { id: "a4", name: "Social Scout", description: "Monitor Facebook pages and groups.", categories: ["Facebook"] },
  { id: "a5", name: "Deal Assistant", description: "Summarize deals and next steps.", categories: ["CRM", "Sales"] },
  { id: "a6", name: "Feedback Analyst", description: "Cluster feedback to themes.", categories: ["Product", "Emails"] },
]

const TOOLS: Tool[] = [
  { id: "t1", name: "Perform Google Search", by: "Reference AI", categories: ["Sales", "Product"] },
  { id: "t2", name: "Extract and Summarize Website Content", by: "Reference AI", categories: ["Product", "Sales"] },
  {
    id: "t3",
    name: "Get a LinkedIn Profile/Company",
    by: "Reference AI",
    categories: ["Sales", "CRM"],
    brand: "LinkedIn",
  },
  { id: "t4", name: "Note", by: "Reference AI", categories: ["Product", "CRM"] },
  { id: "t5", name: "Send Email via Gmail", by: "Reference AI", categories: ["Emails", "Sales"] },
  { id: "t6", name: "Extract Data from PDF", by: "Reference AI", categories: ["Product", "CRM"] },
  {
    id: "t7",
    name: "Extract LinkedIn Prospect Info",
    by: "Reference AI",
    categories: ["Sales", "Facebook"],
    brand: "LinkedIn",
  },
  { id: "t8", name: "Extract Website Content", by: "Reference AI", categories: ["Product"] },
  { id: "t9", name: "Search Google (SERP)", by: "Reference AI", categories: ["Sales"] },
  { id: "t10", name: "Draft Cold Email", by: "Reference AI", categories: ["Emails", "Sales"] },
  { id: "t11", name: "Summarize Meeting Notes", by: "Reference AI", categories: ["CRM", "Product"] },
  { id: "t12", name: "Classify Support Tickets", by: "Reference AI", categories: ["Emails", "Product"] },
]

const container: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
}

const listStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.06 },
  },
}

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

export default function AgentsAndToolsPage() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<Category>("All")

  const filterByCategory = <T extends { categories: Category[] }>(items: T[]) => {
    if (activeCategory === "All") return items
    return items.filter((i) => i.categories.includes(activeCategory))
  }

  const filterByQuery = <T extends { name: string; description?: string }>(items: T[]) => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => [i.name, i.description ?? ""].some((f) => f.toLowerCase().includes(q)))
  }

  const filteredAgents = useMemo(() => filterByQuery(filterByCategory(AGENTS)), [activeCategory, query])

  const filteredTools = useMemo(() => filterByQuery(filterByCategory(TOOLS)), [activeCategory, query])

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-2 md:px-4 font-generalSans">
      {/* Search */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="mb-6"
        aria-label="Search agents and tools"
      >
        <div className="relative w-3/4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search Agents and Tools"
            placeholder="Search Agents and Tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 pl-8 text-base"
          />
          <Button
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2 hidden md:inline-flex"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
      </motion.section>

      {/* Categories */}
      <motion.section
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="mb-8 flex w-full snap-x items-center gap-2 overflow-x-auto pb-2"
        aria-label="Categories"
      >
        {categories.map((cat) => (
          <motion.div variants={item} key={cat} className="snap-start">
            <Button
              variant={activeCategory === cat ? "default" : "outline"}
              onClick={() => setActiveCategory(cat)}
              className={cn("rounded-full px-4", activeCategory === cat ? "bg-info text-background" : "")}
              aria-pressed={activeCategory === cat}
            >
              {cat}
            </Button>
          </motion.div>
        ))}
      </motion.section>

      {/* Available Agents */}
      <section aria-labelledby="agents-heading" className="mb-8">
        <h2 id="agents-heading" className="mb-4 text-2xl font-semibold">
          Available Agents
        </h2>

        <div className="relative">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence initial={false}>
              {filteredAgents.map((agent) => (
                <motion.div
                  key={agent.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="min-w-[260px]"
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Tools */}
      <section aria-labelledby="tools-heading" className="mb-4">
        <h2 id="tools-heading" className="mb-4 text-2xl font-semibold">
          Available Tools
        </h2>
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            initial="hidden"
            animate="show"
            variants={listStagger}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
          >
            {filteredTools.map((tool) => (
              <motion.div key={tool.id} variants={item} layout>
                <ToolRow tool={tool} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredAgents.length === 0 && filteredTools.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">No results. Try a different search or category.</p>
        )}
      </section>
    </main>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  const router = useRouter();
  const handleCardClick = () => {
    router.push(`/agents_and_tools/${agent.id}`); 
  };
  return (
    <Card className="h-full transition-shadow hover:shadow-lg hover:scale-[1.02]" onClick={handleCardClick}>
  <CardHeader className="pb-2">
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        {/* Decorative square to mimic wireframe preview */}
        <AvatarFallback className="bg-muted">A</AvatarFallback>
      </Avatar>
      <div>
        <CardTitle className="text-base">{agent.name}</CardTitle>
        <CardDescription className="line-clamp-1">
          {agent.description}
        </CardDescription>
      </div>
    </div>
  </CardHeader>
  <CardContent className="flex items-center justify-between">
    <div className="flex flex-wrap gap-1">
      {agent.categories.slice(0, 2).map((c,i) => (
        <Badge key={c} variant="secondary" className={`text-xs ${categoryColors[i % categoryColors.length]}`}>
          {c}
        </Badge>
      ))}
    </div>
    <div className="flex items-center gap-1">
      <IconButton label="Run agent" Icon={PlayCircle} />
      <IconButton label="Agent info" Icon={Info} />
    </div>
  </CardContent>
</Card>

  )
}

function ToolRow({ tool }: { tool: Tool }) {
  const initials = (tool.brand ?? tool.name)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="group w-full rounded-md border bg-background p-3 text-left shadow-sm transition-shadow hover:shadow-md"
      aria-label={`Open tool ${tool.name}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-muted font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{tool.name}</p>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p className="truncate text-xs text-muted-foreground">by {tool.by}</p>
        </div>
      </div>
      {tool.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{tool.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1">
        {tool.categories.map((c,i) => (
          <Badge key={c} variant="outline" className={`text-xs border-dashed ${categoryColors[i % categoryColors.length]}`}>
            {c}
          </Badge>
        ))}
      </div>
    </motion.button>
  )
}

function IconButton({
  label,
  Icon,
}: {
  label: string
  Icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <button
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={label}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

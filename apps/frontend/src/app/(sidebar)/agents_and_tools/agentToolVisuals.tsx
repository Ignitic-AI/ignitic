"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Bot,
  Brain,
  Cpu,
  Globe2,
  Headphones,
  Layers,
  LineChart,
  Mail,
  MessageSquare,
  Network,
  Rocket,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Target,
  Telescope,
  Users,
  Wrench,
  Workflow,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const PRIMARY = "#0056D2"

const AGENT_ICONS: LucideIcon[] = [
  Bot,
  Brain,
  Sparkles,
  Zap,
  Cpu,
  Network,
  Workflow,
  LineChart,
  ShoppingBag,
  MessageSquare,
  Mail,
  Search,
  Target,
  Users,
  Headphones,
  BarChart3,
  Globe2,
  Shield,
  Telescope,
  Rocket,
  Layers,
]

const AGENT_GRADIENTS = [
  "from-violet-600 to-fuchsia-500",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-blue-600 to-cyan-500",
  "from-indigo-600 to-violet-500",
  "from-teal-500 to-emerald-600",
]

export function hashIdentifier(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

/** Map built-in agent identifiers (snake_case) to a brand domain for favicons. */
const AGENT_NAME_TO_DOMAIN: Record<string, string> = {
  super_agent: "openai.com",
  shopify_agent: "shopify.com",
  gdrive_agent: "google.com",
  google_drive_agent: "google.com",
  hubspot_agent: "hubspot.com",
  facebook_page_agent: "facebook.com",
  instagram_agent: "instagram.com",
  email_marketing_agent: "mailchimp.com",
  customer_support_agent: "zendesk.com",
  analytics_agent: "google.com",
  seo_agent: "google.com",
  marketer_agent: "hubspot.com",
  product_researcher_agent: "google.com",
  meta_ads_agent: "facebook.com",
  trustpilot_agent: "trustpilot.com",
  google_analytics_agent: "google.com",
  ga4_agent: "google.com",
}

const TOOL_NAME_HINTS: [RegExp, string][] = [
  [/alibaba|alicdn|1688/i, "alibaba.com"],
  [/aliexpress/i, "aliexpress.com"],
  [/shopify/i, "shopify.com"],
  [/hubspot/i, "hubspot.com"],
  [/meta|facebook|instagram|graph\.facebook/i, "facebook.com"],
  [/google|gmail|drive|sheets|docs|calendar|analytics|ga4/i, "google.com"],
  [/brevo|sendinblue/i, "brevo.com"],
  [/mailchimp/i, "mailchimp.com"],
  [/zendesk/i, "zendesk.com"],
  [/trustpilot/i, "trustpilot.com"],
  [/slack/i, "slack.com"],
  [/notion/i, "notion.so"],
  [/openai|gpt|chat.?completion/i, "openai.com"],
  [/n8n|workflow/i, "n8n.io"],
]

export function domainForAgentName(agentSnakeName: string): string | null {
  return AGENT_NAME_TO_DOMAIN[agentSnakeName] ?? null
}

export function domainForTool(toolName: string, sourceAgentName?: string): string | null {
  for (const [re, domain] of TOOL_NAME_HINTS) {
    if (re.test(toolName)) return domain
  }
  if (sourceAgentName) {
    const d = domainForAgentName(sourceAgentName)
    if (d) return d
  }
  return null
}

export function getFaviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`
}

type GlyphSize = "sm" | "md" | "lg" | "xl"

const GLYPH_BOX: Record<GlyphSize, string> = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-12 w-12 rounded-2xl",
  lg: "h-14 w-14 rounded-2xl",
  xl: "h-20 w-20 rounded-3xl",
}

const GLYPH_ICON: Record<GlyphSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
}

export function AgentGlyph({
  agentName,
  className,
  size = "md",
}: {
  agentName: string
  className?: string
  size?: GlyphSize
}) {
  const h = hashIdentifier(agentName)
  const Icon = AGENT_ICONS[h % AGENT_ICONS.length]
  const gradient = AGENT_GRADIENTS[h % AGENT_GRADIENTS.length]
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-gradient-to-br shadow-md ring-2 ring-white/40 dark:ring-slate-950/50",
        GLYPH_BOX[size],
        gradient,
        className
      )}
      aria-hidden
    >
      <Icon className={cn(GLYPH_ICON[size], "text-white drop-shadow-sm")} strokeWidth={1.75} />
    </div>
  )
}

export function ToolBrandIcon({
  toolName,
  sourceAgentName,
  size = 40,
  className,
}: {
  toolName: string
  sourceAgentName?: string
  size?: number
  className?: string
}) {
  const domain = domainForTool(toolName, sourceAgentName)
  const [imgFailed, setImgFailed] = useState(false)
  const h = hashIdentifier(toolName + (sourceAgentName ?? ""))
  const soft = ["bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-amber-500", "bg-rose-500"][h % 5]

  if (!domain || imgFailed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl text-white shadow-inner ring-1 ring-black/5 dark:ring-white/10",
          soft,
          className
        )}
        style={{ width: size, height: size }}
      >
        <Wrench className="h-[55%] w-[55%]" strokeWidth={2} />
      </div>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-800/90 dark:ring-slate-700/80",
        className
      )}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getFaviconUrl(domain, Math.min(128, size * 2))}
        alt=""
        width={size}
        height={size}
        className="max-h-[85%] max-w-[85%] object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
      />
    </span>
  )
}

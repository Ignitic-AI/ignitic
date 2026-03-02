"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import TemplateCard from "@/components/template-card"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from 'next/navigation';
import { useCredits } from "@/context/credits-context";
import { CreditsBlockedState } from "@/components/credits/CreditsBlockedState";

const userTemplates = [
  {
    id: 1,
    name: "Revenue Dashboard",
    description: "Track daily revenue and sales trends",
    icon: "📊",
    lastModified: "Today",
  },
  {
    id: 2,
    name: "Customer Analytics",
    description: "Monitor customer behavior and retention",
    icon: "👥",
    lastModified: "Yesterday",
  },
  {
    id: 3,
    name: "Product Performance",
    description: "Analyze product sales and metrics",
    icon: "📈",
    lastModified: "3 days ago",
  },
  {
    id: 4,
    name: "Inventory Tracker",
    description: "Real-time inventory management insights",
    icon: "📦",
    lastModified: "Last week",
  },
  {
    id: 5,
    name: "Marketing ROI",
    description: "Campaign performance and ROI tracking",
    icon: "🎯",
    lastModified: "Today",
  },
  {
    id: 6,
    name: "Conversion Funnel",
    description: "Visualize your sales conversion flow",
    icon: "🔄",
    lastModified: "2 days ago",
  },
  {
    id: 7,
    name: "Traffic Sources",
    description: "Understand where your traffic comes from",
    icon: "🌐",
    lastModified: "Last week",
  },
  {
    id: 8,
    name: "Customer LTV",
    description: "Lifetime value analysis and forecasts",
    icon: "💎",
    lastModified: "5 days ago",
  },
]

const publicTemplates = [
  {
    id: 101,
    name: "E-commerce Starter",
    description: "Essential metrics for online stores",
    icon: "🛒",
    author: "Analytics Team",
    uses: "2.4K",
  },
  {
    id: 102,
    name: "SaaS Metrics",
    description: "Track MRR, churn, and growth metrics",
    icon: "🚀",
    author: "Platform Team",
    uses: "1.8K",
  },
  {
    id: 103,
    name: "Social Commerce",
    description: "Instagram and TikTok shop analytics",
    icon: "📱",
    author: "Social Team",
    uses: "1.2K",
  },
  {
    id: 104,
    name: "Marketplace Overview",
    description: "Multi-vendor marketplace analytics",
    icon: "🏪",
    author: "Platform Team",
    uses: "980",
  },
  {
    id: 105,
    name: "Customer Segmentation",
    description: "Segment customers by behavior and value",
    icon: "🎯",
    author: "Analytics Team",
    uses: "1.5K",
  },
  {
    id: 106,
    name: "Seasonal Trends",
    description: "Identify seasonal patterns and trends",
    icon: "📅",
    author: "Insights Team",
    uses: "890",
  },
  {
    id: 107,
    name: "Payment Health",
    description: "Monitor payment processing and success",
    icon: "💳",
    author: "Finance Team",
    uses: "1.1K",
  },
  {
    id: 108,
    name: "Returns Analysis",
    description: "Track returns, refunds, and reasons",
    icon: "↩️",
    author: "Operations Team",
    uses: "650",
  },
]

export default function TemplatesPage() {
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter();
  const { hasFeature } = useCredits()
  const analyticsEnabled = hasFeature("analytics.agent_runs") || hasFeature("analytics.agent_usage")

  if (!analyticsEnabled) {
    return <CreditsBlockedState title="Analytics unavailable" message="Your current plan does not include analytics access in this scope." />
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light tracking-tight text-foreground font-generalSans">Templates</h1>
              <p className="text-sm text-muted-foreground mt-2 font-generalSans">Explore and manage your analytics templates</p>
            </div>
            <Button
              onClick={() => router.push('/analytics/edit/new')}
              className="gap-2 bg-foreground hover:bg-foreground/90 text-background"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline font-generalSans">New Template</span>
              <span className="sm:hidden font-generalSans">Add</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* User Templates Section */}
        <section className="mb-20">
          <div className="mb-8">
            <h2 className="text-lg font-light tracking-tight text-foreground font-generalSans">Your Templates</h2>
            <p className="text-sm text-muted-foreground mt-1 font-generalSans">Templates created and saved by you</p>
          </div>

          {/* 2 rows x 4 columns grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {userTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} type="user" />
            ))}
          </div>
        </section>

        {/* Public Templates Section */}
        <section>
          <div className="mb-8">
            <h2 className="text-lg font-light tracking-tight text-foreground font-generalSans">Public Templates</h2>
            <p className="text-sm text-muted-foreground mt-1 font-generalSans">Community-created templates available to everyone</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {publicTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} type="public" />
            ))}
          </div>
        </section>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-8">
            <h3 className="text-lg font-light text-foreground mb-2 font-generalSans">Create New Template</h3>
            <p className="text-sm text-muted-foreground mb-6 font-generalSans">
              Start with a blank template or choose from a starter template
            </p>
            <div className="space-y-3">
              <Link href="/edit/new">
                <Button className="w-full bg-foreground hover:bg-foreground/90 text-background font-generalSans">Blank Template</Button>
              </Link>
              <Button variant="outline" className="w-full bg-transparent">
                From Public Template
              </Button>
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}

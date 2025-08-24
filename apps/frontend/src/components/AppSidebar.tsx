"use client"

import Image from "next/image"
import ProfileIcon  from "@/components/ProfileIcon"
import logo from "../../public/white-logo.png"
import {
  Wallet,
  Users,
  LayoutDashboard,
  Workflow,
  BarChart3,
  KeyRound,
  Settings,
  Zap,
  Building2,
  Target
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import Link from "next/link"

// Main navigation items
const mainNavItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "/",
    description: "Overview & Analytics"
  },
  {
    title: "Organization",
    icon: Building2,
    url: "/organization",
    description: "Team & Settings"
  },
]

const dashboardItems = [
  {
    title: "Secrets",
    icon: KeyRound,
    url: "/secrets",
    description: "API Keys & Tokens"
  },
  {
    title: "Pricing",
    icon: Wallet,
    url: "#",
    description: "Plans & Billing"
  },
  {
    title: "Workflows",
    icon: Workflow,
    url: "#",
    description: "Automation Builder"
  },
  {
    title: "Analytics",
    icon: BarChart3,
    url: "#",
    description: "Performance Data"
  },
  {
    title: "Integrations",
    icon: Zap,
    url: "#",
    description: "Third-party Apps"
  },
  {
    title: "Goals",
    icon: Target,
    url: "#",
    description: "Targets & KPIs"
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar 
      className="border-r border-slate-700 bg-slate-800 text-white" 
      collapsible="icon"
      {...props}
    >
      <SidebarHeader className="border-b border-slate-700 bg-slate-800 text-white">
        <div className="flex items-center justify-center px-3 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center p-2">
              <Image
                src={logo}
                alt="Logo Icon"
                width={24} 
                height={18} 
                className="rounded"  
              />
            </div>
            {!isCollapsed && (
              <div>
                <span className="font-generalSans font-bold text-xl text-white">Ignitic AI</span>
              </div>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 bg-slate-800 text-white font-generalSans">
        {/* Main navigation items */}
        <SidebarMenu>
          {mainNavItems.map((item) => (
            <SidebarMenuButton key={item.title} asChild>
              <Link
                href={item.url}
                className="flex items-center gap-3 px-3 py-2 text-white hover:text-white hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
              >
                <item.icon className="w-5 h-5 text-white drop-shadow-sm" />
                {!isCollapsed && (
                  <span className="font-medium text-white">{item.title}</span>
                )}
              </Link>
            </SidebarMenuButton>
          ))}
        </SidebarMenu>

        {/* Divider line */}
        <div className="border-t border-slate-700 mx-2 my-2" />

        {/* Dashboard section */}
        <SidebarMenu>
          <div className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {!isCollapsed && "Dashboard"}
          </div>
          {dashboardItems.map((item) => (
            <SidebarMenuButton key={item.title} asChild>
              <Link
                href={item.url}
                className="flex items-center gap-3 px-3 py-2 text-white hover:text-white hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
              >
                <item.icon className="w-5 h-5 text-white drop-shadow-sm" />
                {!isCollapsed && (
                  <span className="font-medium text-white">{item.title}</span>
                )}
              </Link>
            </SidebarMenuButton>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
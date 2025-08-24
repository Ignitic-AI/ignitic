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
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

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
      className="rounded-r-xl overflow-hidden shadow-2xl border-r border-slate-200/50 bg-gradient-to-b from-white via-slate-50 to-slate-100" 
      collapsible="icon"
      {...props}
    >
      <SidebarHeader className="border-b border-slate-200/50 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white shadow-lg">
        <div className="flex items-center justify-center px-3 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-xl flex items-center justify-center p-2 shadow-lg">
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

      <SidebarContent className="gap-1 bg-transparent text-slate-700 font-generalSans">
        {/* Main navigation items */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={cn(
                      "px-2 py-2 mt-1 rounded-lg mx-1 hover:bg-gradient-to-r hover:from-slate-100 hover:to-blue-50 hover:text-slate-900 transition-all duration-200 hover:shadow-sm",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <a href={item.url} className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                        <item.icon className="h-4 w-4 text-white" />
                      </div>
                      {!isCollapsed && (
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 text-sm">{item.title}</div>
                        </div>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider line */}
        <div className="border-t border-slate-200/50 mx-2 my-2" />

        {/* Dashboard section */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={cn(
                      "px-2 py-2 mt-1 rounded-lg mx-1 hover:bg-gradient-to-r hover:from-slate-100 hover:to-indigo-50 hover:text-slate-900 transition-all duration-200 hover:shadow-sm",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <a href={item.url} className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 rounded-lg flex items-center justify-center shadow-sm">
                        <item.icon className="h-4 w-4 text-white" />
                      </div>
                      {!isCollapsed && (
                        <div className="flex-1">
                          <div className="font-medium text-slate-700 text-sm">{item.title}</div>
                        </div>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom section */}
        <div className="mt-auto pt-4">
          <div className="mx-2 p-3 bg-gradient-to-r from-red-50 via-orange-50 to-red-100 rounded-lg border border-red-200/50 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm"></div>
              <span className="text-xs font-medium text-red-700">1 Issue</span>
              <button className="ml-auto text-xs text-red-600 hover:text-red-800">×</button>
            </div>
          </div>
        </div>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
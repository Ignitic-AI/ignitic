"use client"

import {
  ChevronLeft,
  Search,
  FileText,
  Users,
  BarChart3,
  TrendingUp,
  FileIcon as FileTemplate,
  UserCheck,
  Puzzle,
  Settings,
  Plus,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Main navigation items
const mainNavItems = [
  {
    title: "Reports",
    icon: FileText,
    url: "#",
  },
  {
    title: "Contracts",
    icon: Users,
    url: "#",
  },
]

const dashboardItems = [
  {
    title: "Dashboard",
    icon: BarChart3,
    url: "#",
  },
  {
    title: "Analytics",
    icon: TrendingUp,
    url: "#",
  },
  {
    title: "Templates",
    icon: FileTemplate,
    url: "#",
  },
  {
    title: "Clients",
    icon: UserCheck,
    url: "#",
  },
  {
    title: "Integrations",
    icon: Puzzle,
    url: "#",
  },
  {
    title: "Settings",
    icon: Settings,
    url: "#",
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar 
      className="border-r-0" 
      collapsible="icon"
      {...props}
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-white text-black text-sm font-bold">
              I
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-sidebar-foreground">Lunor</span>
            )}
          </div>
          
        </div>
        {!isCollapsed && (
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/50" />
              <SidebarInput placeholder="Search" className="pl-8 bg-sidebar-accent/50 border-0" />
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Main navigation items */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={cn(
                      "px-2",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dashboard section */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={cn(
                      "px-2",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
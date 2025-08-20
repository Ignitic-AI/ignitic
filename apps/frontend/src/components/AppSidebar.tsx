"use client"

import Image from "next/image"
import logo from "../../public/white-logo.png"
import {
  Wallet,
  Users,
  LayoutDashboard,
  Workflow,
  ChartNoAxesCombined,
  KeyRound
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
  },
  {
    title: "Organization",
    icon: Users,
    url: "/organization",
  },
]

const dashboardItems = [
  {
    title: "Secrets",
    icon: KeyRound,
    url: "/secrets",
  },
  {
    title: "Pricing",
    icon: Wallet,
    url: "#",
  },
  {
    title: "Workflows",
    icon: Workflow,
    url: "#",
  },
  {
    title: "Analytics",
    icon: ChartNoAxesCombined,
    url: "#",
  },
  // {
  //   title: "Integrations",
  //   icon: Puzzle,
  //   url: "#",
  // },
  // {
  //   title: "Settings",
  //   icon: Settings,
  //   url: "#",
  // },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar 
      className="rounded-r-xl overflow-hidden shadow-lg" 
      collapsible="icon"
      {...props}
    >
      <SidebarHeader className="border-b border-sidebar-border bg-bg-light text-text">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <Image
      src={logo}
      alt="Logo Icon"
      width={20} 
      height={14} 
      className="icon-class rounded "  
    />
            {!isCollapsed && (
              <span className="font-generalSans font-semibold text-2xl  text-dHighlight">Ignitic AI</span>
            )}
          </div>
          
        </div>
        {/* {!isCollapsed && (
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 bg-text-muted" />
              <SidebarInput placeholder="Search" className="pl-8  border-0 bg-text-muted" />
            </div>
          </div>
        )} */}
      </SidebarHeader>

      <SidebarContent className="gap-0 bg-bg-light text-text font-generalSans font-extralight">
        {/* Main navigation items */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={cn(
                      "px-2 mt-3",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span className="text-lg">{item.title}</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider line */}
<div className="border-t border-border mx-2 my-2" />

        {/* Dashboard section */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={cn(
                      "px-2 mb-3",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span className="text-lg">{item.title}</span>}
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
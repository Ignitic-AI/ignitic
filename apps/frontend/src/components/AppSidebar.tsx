"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import wlogo from "../../public/white-logo.png"
import dlogo from "../../public/dark-logo.png"
import {
  Users,
  LayoutDashboard,
  Workflow,
  ChartNoAxesCombined,
  KeyRound,
  FolderInput,
  Bot,
  MessageCircleMore
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
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
    title: "Workflows",
    icon: Workflow,
    url: "/workflows",
  },
{title: "Chat", icon: MessageCircleMore, url: "/chat"},
  {
    title: "Assets",
    icon: FolderInput,
    url:"/assets"
  },
  {
    title: "Secrets & Integrations",
    icon: KeyRound,
    url: "/secrets",
  },
  {
    title: "Agents & Tools",
    icon: Bot,
    url: "/agents_and_tools",
  },
  
  {
    title: "Analytics",
    icon: ChartNoAxesCombined,
    url: "/analytics",
  },
  // {
  //   title: "Settings",
  //   icon: Settings,
  //   url: "#",
  // },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const router = useRouter()
  const pathname = usePathname()

  const handleChatClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.preventDefault(); // Stop the default <a> navigation
    const randomId = crypto.randomUUID();
    router.push(`/chat/${randomId}`);
  };

  const isItemActive = (url: string) => {
    if (!pathname) return false
    if (url === "/") return pathname === "/"
    return pathname === url || pathname.startsWith(`${url}/`)
  }

  return (
    <Sidebar
      className="overflow-hidden border-border-lm shadow-sm dark:border-border"
      collapsible="icon"
      {...props}
    >
      <SidebarHeader className="border-b border-border-lm dark:border-border dark:bg-bg-light dark:text-text bg-bg-light-lm text-text-lm">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <Image
      src={dlogo}
      alt="White Logo Icon"
      width={20} 
      height={14} 
      className="icon-class rounded block dark:hidden"  
    />
    <Image
      src={wlogo}
      alt="Dark Logo Icon"
      width={20} 
      height={14} 
      className="icon-class rounded hidden dark:block"  
    />
            {!isCollapsed && (
              <span className="font-generalSans font-semibold text-2xl  text-text-lm dark:text-text">Ignitic AI</span>
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

      <SidebarContent className="gap-0 dark:bg-bg-light dark:text-text bg-bg-light-lm text-text-lm font-generalSans font-extralight">
        {/* Main navigation items */}
        <SidebarGroup className="py-2 mt-3">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isItemActive(item.url)}
                    className={cn(
                      "px-2 py-6",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <motion.a 
                      href={item.url}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <motion.div
                        variants={{
                          rest: { scale: 1, rotate: 0 },
                          hover: { scale: 1.15, rotate: 4 },
                          tap: { scale: 0.95, rotate: -2 }
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="flex items-center justify-center shrink-0"
                      >
                        <item.icon className="h-4 w-4" />
                      </motion.div>
                      {!isCollapsed && <span className="text-lg ">{item.title}</span>}
                    </motion.a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider line */}
<div className="border-t border-border-lm dark:border-white/70  mx-2 my-2" />

        {/* Dashboard section */}
        <SidebarGroup className="py-2 mt-3">
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isItemActive(item.url)}
                    className={cn(
                      "px-2 py-6  ",
                      isCollapsed && "justify-center"
                    )}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <motion.a 
                      href={item.url}
                      onClick={item.title === "Chat" ? handleChatClick : undefined}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <motion.div
                        variants={{
                          rest: { scale: 1, rotate: 0 },
                          hover: { scale: 1.15, rotate: 8 },
                          tap: { scale: 0.95, rotate: -2 }
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="flex items-center justify-center shrink-0"
                      >
                        <item.icon className="h-4 w-4" />
                      </motion.div>
                      {!isCollapsed && <span className="text-lg ">{item.title}</span>}
                    </motion.a>
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
"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import OrgDropdown from "@/components/OrgDropdown"
import ChatSidebar from "@/components/ChatSidebar"
import { CirclePlus, Paperclip } from "lucide-react"
import {  SendHorizonal,  ChevronUp } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/ThemeToggle"
import Image from "next/image"
import { cn } from "@/lib/utils"
import wlogo from "@/../public/white-logo.png"
import dlogo from "@/../public/dark-logo.png"
import { useState } from "react"



export default function Chat() {
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inputValue, setInputValue] = useState("")

  const handleSend = () => {
    if (inputValue.trim()) {
      console.log("Sending message:", inputValue)
      setInputValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  return (
    <div className="flex h-screen bg-bg-light-lm dark:bg-bg-light font-generalSans">
      {/* Left Sidebar */}
      <Sidebar
      className={cn(
        "bg-bg text-white flex flex-col rounded-r-xl overflow-hidden shadow-lg transition-all duration-300",
        isCollapsed ? "w-16" : "w-64" 
      )}
    >
        {/* Header */}
        <SidebarHeader className="border-b border-border-lm dark:border-border dark:bg-bg-dark dark:text-text bg-bg-dark-lm text-text-lm">
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

        <SidebarContent className="gap-0 bg-bg-dark-lm dark:bg-bg-dark text-text-lm dark:text-text font-generalSans font-extralight ">
        {/* New Chat Button */}
        <div className={cn("px-2 py-3", isCollapsed && "justify-center")}>
          <Button className="w-full bg-dblue hover:bg-[#1a2951] text-white rounded-lg flex items-center gap-2">
            <CirclePlus className="w-5 h-5 text-white" />
            {!isCollapsed && "New Chat"}
          </Button>
        </div>

        {/* Chat History Groups */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Today */}
              <div className="px-2 py-2">
                {!isCollapsed && (
                  <>
                  <h3 className="text-sm text-text-muted-lm dark:text-text-muted mb-2">Today</h3>
                  <SidebarMenuItem>
                  <SidebarMenuButton
                    className={cn("bg-dblue rounded-lg px-3 py-2", isCollapsed && "justify-center")}
                  >
                    <span className="text-sm text-white ">SEO Performance Review</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                  </>
                  
                )}
                
              </div>

              {/* Yesterday */}
<div className="px-2 py-2">
  {!isCollapsed && (
    <>
      <h3 className="text-sm text-text-muted-lm dark:text-text-muted mb-2">Yesterday</h3>
      <SidebarMenuItem>
        <SidebarMenuButton
          className={cn(
            "hover:bg-dblue hover:text-text rounded-lg px-3 py-2",
            isCollapsed && "justify-center"
          )}
        >
          <span className="text-sm">Inventory Management</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )}
</div>


              {/* Last Week */}
              <div className="px-2 py-2">
                {!isCollapsed && (
                  <>
                    <h3 className="text-sm text-text-muted-lm dark:text-text-muted mb-2">Last Week</h3>
                    <SidebarMenuItem>
                  <SidebarMenuButton
                    className={cn("hover:bg-dblue hover:text-text rounded-lg px-3 py-2 mb-2", isCollapsed && "justify-center")}
                  >
                    <span className="text-sm">Ad Campaign Analysis</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className={cn("hover:bg-dblue hover:text-text rounded-lg px-3 py-2", isCollapsed && "justify-center")}
                  >
                    <span className="text-sm">Customer Support</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                  </>
                )}
                
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-bg-light-lm dark:bg-bg-light">
        {/* Top Header */}
        <div className="flex items-center justify-between p-2 border-b">
<OrgDropdown/>
<ModeToggle/>
        </div>
        

        {/* Chat Messages */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* User Message */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-black rounded-full flex-shrink-0"></div>
              <div className="bg-[#bdcbf2] rounded-2xl p-4 max-w-2xl">
                <p className="text-bg">Let me add 2 more agents for Instagram and Tiktok marketing</p>
              </div>
            </div>

            

            {/* Market Scraper Response */}
            <div className="bg-[#c5cad6] rounded-2xl p-4 max-w-2xl ml-11">
              <h4 className="font-semibold text-[#0d1017] mb-2">Market Scraper</h4>
              <p className="text-[#4b5275] text-sm mb-3">
                → Fetched latest ads trends for the product on Instagram and Tiktok
              </p>
          
            </div>

            {/* Final Response */}
            <div className="bg-[#c5cad6] rounded-2xl p-4 max-w-2xl ml-11">
              <p className="text-[#0d1017]">
                Added 2 more agents for Instagram and Tiktok marketing based on latest trends
              </p>
              
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-[#bdcbf2] p-4">
  <div className="max-w-4xl mx-auto flex items-center gap-3 relative">
    {/* Input with Send Button */}
    <div className="flex-1 relative">
      <Paperclip
        className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-bg"
      />
      <Input
        type="text"
        style={{ fontSize: '18px' }}
        className="w-full h-16 pl-12 pr-14 border-2 border-info rounded-full 
             focus-visible:ring-0 focus-visible:ring-offset-0 bg-text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {/* Send Button inside input */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full 
                   text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        onClick={handleSend}
        disabled={!inputValue.trim()}
      >
        <SendHorizonal style={{ width: "28px", height: "28px" }} />
      </Button>
    </div>

    {/* Auto Button */}
    <div className="flex flex-col items-center">
  <Button className="bg-[#191828] hover:bg-[#2a2640] text-white px-6 rounded-full">
    <ChevronUp className="w-4 h-4 text-white" />
    Auto
  </Button>
  <span className="text-dblue text-[11px] text-center leading-tight mt-1">
    Model 
    Selection
  </span>
</div>

    {/* Model Selection */}
    {/* <div className="w-12 h-12 bg-[#111e42] rounded-full flex items-center justify-center">
      <ArrowUpRight className="w-4 h-4 text-white" />
    </div> */}
  </div>
</div>

      </div>

      {/* Right Sidebar */}
      <ChatSidebar/>
    </div>
  )
}

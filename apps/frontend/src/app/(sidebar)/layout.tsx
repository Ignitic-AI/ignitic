import type { Metadata } from "next"
import "../../app/globals.css"
import SessionProviderWrapper from "@/components/SessionProviderWrapper"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import ProfileIcon  from "@/components/ProfileIcon"
import { Separator } from "@/components/ui/separator"
import UserAvatar from "@/components/UserAvatar"
import { OrgProvider } from "@/app/providers"
import OrgDropdown from "@/components/OrgDropdown"
import { ModeToggle } from "@/components/ThemeToggle"
import OrgInvite from "@/components/OrgInvite"
import { CreditsProvider } from "@/context/credits-context"

export const metadata: Metadata = {
  title: "Ignitic AI",
  description: "Ignitic AI - Your AI-Powered Assistant",
}

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  
  return (

   
        
        <SessionProviderWrapper>
          <OrgProvider>
          <CreditsProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0 overflow-x-hidden bg-bg-dark-lm dark:bg-bg-dark">
              {/* Header — same surface + horizontal inset as page content */}
              <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-lm justify-between bg-bg-dark-lm px-4 dark:border-border dark:bg-bg-dark sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <SidebarTrigger className="h-8 w-8 shrink-0 dark:bg-info bg-info-lm" />
                  <OrgDropdown />
                </div>
       
                 <div className="flex items-center gap-4">
                   {/* Collapsible Search Bar */}
                   
       
                   {/* Action Buttons */}
                   <div className="flex items-center gap-3">
                    <ModeToggle/>
                     {/* <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                       <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                       </svg>
                     </button>
                     <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative">
                       <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5a2.25 2.25 0 01-2.25-2.25V4.5a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25v12.75a2.25 2.25 0 01-2.25 2.25h-15z" />
                       </svg>
                       <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                     </button> */}
                     <Separator orientation="vertical" className="h-6" />
                     
                     {/* User Avatars */}
                      <UserAvatar />
                     
                     {/* Invite Button */}
                     <OrgInvite />
                     
                     <Separator orientation="vertical" className="h-6" />
                     <ProfileIcon />
                   </div>
                 </div>
               </header>

              {/* Page content — inherits inset background; padding matches header */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex w-full min-w-0 flex-1 flex-col px-4 sm:px-6 lg:px-8">{children}</div>
              </div>
            </SidebarInset>
          </SidebarProvider>
          </CreditsProvider>
          </OrgProvider>
        </SessionProviderWrapper>
     
  )
}

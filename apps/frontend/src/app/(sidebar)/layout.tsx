import type { Metadata } from "next"
import "../../app/globals.css"
import SessionProviderWrapper from "@/components/SessionProviderWrapper"
import { Toaster } from "@/components/ui/sonner"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage
} from "@/components/ui/breadcrumb"
import ProfileIcon  from "@/components/ProfileIcon"
import { Separator } from "@/components/ui/separator"
import { SearchBar } from "@/components/SearchBar"

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
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 min-h-screen">
        <SessionProviderWrapper>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Header */}
              <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 justify-between bg-white px-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition-all duration-200 shadow-md" />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink href="/" className="hover:text-slate-600 transition-colors">
                          <span className="font-semibold font-generalSans text-lg text-slate-800">Dashboard</span>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block text-slate-400" />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-slate-600 font-semibold font-generalSans text-lg">
                          Overview
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
       
                 <div className="flex items-center gap-4">
                   {/* Collapsible Search Bar */}
                   <SearchBar />
       
                   {/* Action Buttons */}
                   <div className="flex items-center gap-3">
                     <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                       <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                       </svg>
                     </button>
                     <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative">
                       <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5a2.25 2.25 0 01-2.25-2.25V4.5a2.25 2.25 0 012.25-2.25h15a2.25 2.25 0 012.25 2.25v12.75a2.25 2.25 0 01-2.25 2.25h-15z" />
                       </svg>
                       <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                     </button>
                     <Separator orientation="vertical" className="h-6" />
                     
                     {/* User Avatars */}
                     <div className="flex items-center gap-2">
                       <div className="flex -space-x-2">
                         <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                           J
                         </div>
                         <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                           S
                         </div>
                         <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                           M
                         </div>
                       </div>
                       <span className="text-xs text-slate-600 font-medium">+10</span>
                     </div>
                     
                     {/* Invite Button */}
                     <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                       </svg>
                       Invite
                     </button>
                     
                     <Separator orientation="vertical" className="h-6" />
                     <ProfileIcon />
                   </div>
                 </div>
               </header>

              {/* Page content */}
              <div className="flex flex-1 flex-col bg-gradient-to-br from-slate-50/50 via-blue-50/30 to-indigo-100/50">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </SessionProviderWrapper>
      </body>
    </html>
  )
}

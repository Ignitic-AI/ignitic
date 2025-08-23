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
      <body className="bg-bg">
        <SessionProviderWrapper>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Header */}
              <header className="flex h-16 shrink-0 items-center gap-2 border-b justify-between">
                <div className="flex items-center gap-2 ml-2">
                  <SidebarTrigger className="bg-text" />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block text-text font-semibold font-generalSans text-lg">
                        <BreadcrumbLink href="/" className="hover:text-text-muted">
                          Dashboard
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-text-muted font-semibold font-generalSans text-lg">
                          Overview
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>

                <div className="flex items-center gap-2 mr-2">
                  {/* <ProfileIcon /> */}
                  <Separator orientation="vertical" className="h-4" />
                </div>
              </header>

              {/* Page content */}
              <div className="flex flex-1 flex-col gap-4 p-4">
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

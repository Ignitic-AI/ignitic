import SessionProviderWrapper from "@/components/SessionProviderWrapper"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function NoSidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
<SessionProviderWrapper>
  <SidebarProvider>
<main className="w-full h-full min-h-screen">
      {children}
    </main>
  </SidebarProvider>
</SessionProviderWrapper>
    
  )
}
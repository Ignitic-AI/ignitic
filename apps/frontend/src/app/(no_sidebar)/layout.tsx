import SessionProviderWrapper from "@/components/SessionProviderWrapper"
import { SidebarProvider } from "@/components/ui/sidebar"
import { CreditsProvider } from "@/context/credits-context"

export default function NoSidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
<SessionProviderWrapper>
  <CreditsProvider>
    <SidebarProvider>
  <main className="w-full h-full min-h-screen">
        {children}
      </main>
    </SidebarProvider>
  </CreditsProvider>
</SessionProviderWrapper>
    
  )
}

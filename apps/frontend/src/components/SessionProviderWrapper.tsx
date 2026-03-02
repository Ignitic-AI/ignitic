"use client"

import { SessionProvider } from "next-auth/react"
import SessionSyncer from "./SessionSyncer"

export default function SessionProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider refetchInterval={5 * 60}>
      <SessionSyncer />
      {children}
    </SessionProvider>
  )
}

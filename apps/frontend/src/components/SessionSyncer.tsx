"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useSessionStore } from "@/app/_store/useSessionStore"

export default function SessionSyncer() {
  const { data: session, status } = useSession()
  const { setSession, currentSession, clearSession } = useSessionStore()

  useEffect(() => {
    const isExpired = (expires: string) => new Date(expires) < new Date()

    if (status === 'loading') {
      if (currentSession?.expires && isExpired(currentSession.expires)) {
        clearSession()
      }
      return
    }

    if (status === "authenticated") {
      if (session?.expires && isExpired(session.expires)) {
        signOut()
      } else {
        setSession(session)
      }
    } else if (status === "unauthenticated") {
      setSession(null)
    }
  }, [session, status, setSession, currentSession, clearSession])

  return null
}

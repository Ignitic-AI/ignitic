"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { useSessionStore } from "@/app/_store/useSessionStore"

export default function SessionSyncer() {
  const { data: session, status } = useSession()
  const setSession = useSessionStore((state) => state.setSession)

  useEffect(() => {
    if (status === "authenticated") {
      setSession(session)
    } else if (status === "unauthenticated") {
      setSession(null)
    }
  }, [session, status, setSession])

  return null
}

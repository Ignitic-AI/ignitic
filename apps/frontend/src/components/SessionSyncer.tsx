"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useSessionStore } from "@/app/_store/useSessionStore"
import axios from "axios"

export default function SessionSyncer() {
  const { data: session, status } = useSession()
  const { setSession, currentSession, clearSession } = useSessionStore()

  // Helper: sign out AND eagerly wipe the Zustand persisted store
  const forceLogout = () => {
    clearSession()
    signOut()
  }

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          forceLogout()
        }
        return Promise.reject(error)
      }
    )

    return () => {
      axios.interceptors.response.eject(interceptor)
    }
  }, [])

  useEffect(() => {
    const isExpired = (expires: string) => new Date(expires) < new Date()

    if (status === 'loading') {
      if (currentSession?.expires && isExpired(currentSession.expires)) {
        clearSession()
      }
      return
    }

    if (status === "authenticated") {
      // If the jwt callback flagged the backend token as expired, log out
      if ((session as any)?.error === "TokenExpired") {
        forceLogout()
        return
      }

      if (session?.expires && isExpired(session.expires)) {
        forceLogout()
      } else {
        setSession(session)
      }
    } else if (status === "unauthenticated") {
      clearSession()
    }
  }, [session, status, setSession, currentSession, clearSession])

  return null
}

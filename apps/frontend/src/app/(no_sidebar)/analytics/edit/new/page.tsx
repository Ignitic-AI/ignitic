"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoadingLogo } from "@/components/Loading"

/** Legacy URL: dashboard builder now lives on /analytics */
export default function LegacyAnalyticsEditorRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/analytics")
  }, [router])

  return <LoadingLogo />
}

"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useOrgStore } from "@/app/_store/useorgStore"
import {
  canUseAction,
  fetchCreditsEntitlements,
  fetchCreditsOverview,
  fetchCreditsRecords,
  featureEnabled,
  modelAllowed,
  toolAllowed,
  toFriendlyCreditsError,
  type ActionAccessResult,
  type CreditsEntitlements,
  type CreditsOverview,
  type CreditsRecordsResponse,
} from "@/lib/credits"

type CreditsContextValue = {
  organizationId: string | null
  overview: CreditsOverview | null
  entitlements: CreditsEntitlements | null
  recordsResponse: CreditsRecordsResponse | null
  isLoading: boolean
  isLoadingRecords: boolean
  error: string | null
  refresh: () => Promise<void>
  fetchRecords: (page?: number, pageSize?: number) => Promise<void>
  hasFeature: (featureKey: string) => boolean
  canUseFeatureAction: (actionKey: string, modelId?: string) => ActionAccessResult
  canUseModel: (modelId: string) => boolean
  canUseTool: (toolName: string) => boolean
}

const CreditsContext = createContext<CreditsContextValue | undefined>(undefined)

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const organizationId = currentOrg?.id ?? null

  const token = session?.user?.token

  const [overview, setOverview] = useState<CreditsOverview | null>(null)
  const [entitlements, setEntitlements] = useState<CreditsEntitlements | null>(null)
  const [recordsResponse, setRecordsResponse] = useState<CreditsRecordsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      const [overviewData, entitlementData] = await Promise.all([
        fetchCreditsOverview(token, organizationId),
        fetchCreditsEntitlements(token, organizationId),
      ])
      setOverview(overviewData)
      setEntitlements(entitlementData)
    } catch (err) {
      setError(toFriendlyCreditsError(err))
    } finally {
      setIsLoading(false)
    }
  }, [token, organizationId])

  const fetchRecords = useCallback(
    async (page = 1, pageSize = 20) => {
      if (!token) return

      setIsLoadingRecords(true)
      setError(null)
      try {
        const response = await fetchCreditsRecords(token, {
          organizationId,
          page,
          pageSize,
        })
        setRecordsResponse(response)
      } catch (err) {
        setError(toFriendlyCreditsError(err))
      } finally {
        setIsLoadingRecords(false)
      }
    },
    [token, organizationId]
  )

  useEffect(() => {
    if (!token) {
      setOverview(null)
      setEntitlements(null)
      setRecordsResponse(null)
      setError(null)
      return
    }

    refresh()
    fetchRecords(1, 20)
  }, [token, organizationId, refresh, fetchRecords])

  const value = useMemo<CreditsContextValue>(
    () => ({
      organizationId,
      overview,
      entitlements,
      recordsResponse,
      isLoading,
      isLoadingRecords,
      error,
      refresh,
      fetchRecords,
      hasFeature: (featureKey: string) => featureEnabled(entitlements, featureKey),
      canUseFeatureAction: (actionKey: string, modelId?: string) => canUseAction(overview, entitlements, actionKey, modelId),
      canUseModel: (modelId: string) => modelAllowed(entitlements, modelId),
      canUseTool: (toolName: string) => toolAllowed(entitlements, toolName),
    }),
    [organizationId, overview, entitlements, recordsResponse, isLoading, isLoadingRecords, error, refresh, fetchRecords]
  )

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>
}

export function useCredits() {
  const ctx = useContext(CreditsContext)
  if (!ctx) {
    throw new Error("useCredits must be used within CreditsProvider")
  }
  return ctx
}

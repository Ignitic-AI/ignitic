"use client"

import {useState, useEffect, useMemo} from "react"
import { Plus, Key, Trash2, Edit, Lock, ChevronDown, ChevronRight, MoreHorizontal, Search, Shield, CheckCircle2, AlertCircle, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import axios from "axios"
import { useSession, signIn} from "next-auth/react"
import { AppLogo, getDisplayNameFromKey } from "./appLogos"
import schema from "./n8n_credentials_schema.json"
import { LoadingLogo } from "@/components/Loading"
import { useCredits } from "@/context/credits-context"
import { CreditsBlockedState } from "@/components/credits/CreditsBlockedState"
import OrgDropdown from "@/components/OrgDropdown"
import { useOrgStore } from "@/app/_store/useorgStore"

const API_BASE_URL = "http://localhost:8080"
const SHOPIFY_OAUTH_PENDING_KEY = "shopify_oauth_pending"

const HIDDEN_CREDENTIAL_SCHEMA_KEYS = new Set([
  "hubspotApi",
  "hubspotAppToken",
  "hubspotOAuth2Api",
])

function schemaEntriesFiltered(): [string, unknown][] {
  return Object.entries(schema as Record<string, unknown>).filter(
    ([key]) => !HIDDEN_CREDENTIAL_SCHEMA_KEYS.has(key)
  )
}

// Build app tiles directly from schema top-level keys
const toTitle = (key: string) => key
  .replace(/Api$/i, "")
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/[_-]+/g, " ")
  .replace(/^\w/, (m) => m.toUpperCase())

type SchemaApp = { key: string; name: string; description?: string; logo?: any }

interface Credential {
  id: number
  app: string
  name: string
  value: string
  description: string
  createdAt: string
}

interface AppGroup {
  app: string
  credentials: Credential[]
  isExpanded: boolean
}

interface App {
  name: string
  description: string
  logo: string
}

interface ShopifyConnectionStatus {
  connected: boolean
  shop: string
  organization_id?: string | null
  scope?: string
  updated_at?: string
}

const Page = () => {
  const { data: session, status } = useSession()
  const { hasFeature } = useCredits()
  const currentOrg = useOrgStore((s) => s.currentOrg)
  const organizations = useOrgStore((s) => s.organizations)
  const canReadSecrets = hasFeature("secrets.read")
  const canWriteSecrets = hasFeature("secrets.write")
  const canDeleteSecrets = hasFeature("secrets.delete")

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())
  const appTiles: SchemaApp[] = useMemo(() => {
    return schemaEntriesFiltered().map(([key]) => ({
      key,
      name: toTitle(key),
    }))
  }, [])
  const [appSearch, setAppSearch] = useState("")
  const filteredAppTiles = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
    const q = norm(appSearch)
    if (!q) return appTiles
    return appTiles.filter(t => norm(t.name).includes(q) || norm(t.key).includes(q))
  }, [appTiles, appSearch])
  const [step, setStep] = useState<"select" | "form">("select")
  const [selectedApp, setSelectedApp] = useState<App | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdateMode, setIsUpdateMode] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [selectedShareApp, setSelectedShareApp] = useState<string | null>(null)
  const [shareTargetOrgId, setShareTargetOrgId] = useState<string>("")
  const [isSharing, setIsSharing] = useState(false)
  const [visibleValues, setVisibleValues] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)

  // Group credentials by app
  const appGroups: AppGroup[] = useMemo(() => {
    const groups = credentials.reduce((acc, credential) => {
      const existingGroup = acc.find(group => group.app === credential.app)
      if (existingGroup) {
        existingGroup.credentials.push(credential)
      } else {
        acc.push({
          app: credential.app,
          credentials: [credential],
          isExpanded: expandedApps.has(credential.app)
        })
      }
      return acc
    }, [] as AppGroup[])
    
    return groups.sort((a, b) => a.app.localeCompare(b.app))
  }, [credentials, expandedApps])

  const shareableOrganizations = useMemo(
    () =>
      organizations.filter((org: any) => {
        const role = String(org?.role || "").toLowerCase()
        return role === "admin" || role === "owner"
      }),
    [organizations]
  )

  const toggleAppExpansion = (app: string) => {
    setExpandedApps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(app)) {
        newSet.delete(app)
      } else {
        newSet.add(app)
      }
      return newSet
    })
  }

  // Form state
  const [formData, setFormData] = useState({
    app: "",
    description: "",
  })
  const [credentialType, setCredentialType] = useState<string>("")
  const [propertyValues, setPropertyValues] = useState<Record<string, string | boolean | number>>({})
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false)
  const [googleOAuthState, setGoogleOAuthState] = useState<string | null>(null)
  const [isShopifyAuthLoading, setIsShopifyAuthLoading] = useState(false)
  const [isShopifyStatusLoading, setIsShopifyStatusLoading] = useState(false)
  const [isShopifyDisconnecting, setIsShopifyDisconnecting] = useState(false)
  const [shopifyConnectionStatus, setShopifyConnectionStatus] = useState<ShopifyConnectionStatus | null>(null)

  const fetchSecrets = async (token: string, orgId?: string | null) => {
    if (!token) return
    const url = orgId
      ? `${API_BASE_URL}/api/v1/secrets/organization/${orgId}`
      : `${API_BASE_URL}/api/v1/secrets/user/all`
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
    setCredentials(response.data.secrets || [])
  }

  useEffect(() => {
    if (!session?.user?.token) return

    const load = async () => {
      try {
        await fetchSecrets(session.user.token, currentOrg?.id)
      } catch (error) {
        console.error("Failed to fetch secrets:", error)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [session?.user?.token, currentOrg?.id])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "google_oauth_tokens" || !event.data?.data) return
      const payload = event.data.data
      const oauth_token_data = payload?.oauth_token_data ?? payload?.OAuthTokenData
      const additional_properties = payload?.additional_properties ?? payload?.AdditionalProperties
      if (oauth_token_data) {
        setPropertyValues((prev) => ({
          ...prev,
          oauthTokenData: JSON.stringify(oauth_token_data, null, 2),
          additionalBodyProperties: additional_properties
            ? JSON.stringify(additional_properties, null, 2)
            : "",
          sendAdditionalBodyProperties: true,
        }))
        setIsGoogleAuthLoading(false)
        toast.success("✅ OAuth tokens received! Review and click 'Add Credential' to save.")
      }
      sessionStorage.removeItem("google_oauth_state")
      sessionStorage.removeItem("google_oauth_credential_type")
      sessionStorage.removeItem("google_oauth_timestamp")
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  // Handle popup redirect: we're in popup with google_oauth_code - fetch tokens, postMessage to opener, close
  useEffect(() => {
    if (typeof window === "undefined" || !session?.user?.token) return
    const params = new URLSearchParams(window.location.search)
    const code = params.get("google_oauth_code")
    if (!code || !window.opener || window.opener.closed) return

    let done = false
    const run = async () => {
      if (done) return
      done = true
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/google-oauth/popup-tokens?code=${encodeURIComponent(code)}`,
          { headers: { Authorization: `Bearer ${session!.user!.token}` } }
        )
        const data = res.data
        if (data?.oauth_token_data && !window.opener.closed) {
          window.opener.postMessage({ type: "google_oauth_tokens", data }, "*")
        }
      } catch (_) {
        // Code expired or already used - don't overwrite parent
      } finally {
        const u = new URL(window.location.href)
        u.searchParams.delete("google_oauth_code")
        window.history.replaceState({}, "", u.toString())
        window.close()
      }
    }
    run()
  }, [session?.user?.token])

  // Handle same-window redirect (when callback redirects to /secrets?google_oauth=success|error)
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const status = params.get("google_oauth")
    const errorMsg = params.get("message")
    const cleanUrl = () => {
      const u = new URL(window.location.href)
      ;["google_oauth", "credential_type", "email", "message", "google_oauth_code"].forEach((k) => u.searchParams.delete(k))
      window.history.replaceState({}, "", u.toString())
    }
    if (status === "success") {
      toast.success("✅ Google OAuth completed! Credentials saved.")
      cleanUrl()
      if (session?.user?.token) {
        fetchSecrets(session.user.token, currentOrg?.id)
          .catch(() => {})
      }
    } else if (status === "error") {
      toast.error(errorMsg || "Google OAuth failed")
      cleanUrl()
    }
  }, [session?.user?.token, currentOrg?.id])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Build a normalized map of credential types from schema
  type SchemaDef = { properties?: Record<string, { type?: string }>; required?: string[] }
  const credentialTypes: { key: string; def: SchemaDef }[] = useMemo(() => {
    if (!schema || typeof schema !== "object") return []
    return schemaEntriesFiltered().map(([key, def]) => ({
      key,
      def: def as SchemaDef,
    }))
  }, [])

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const isShopifyOAuth = (type: string) => /shopify.*oauth/i.test(type)
  const normalizeShopDomain = (value: string) => {
    const raw = value.trim().toLowerCase()
    if (!raw) return ""
    if (raw.endsWith(".myshopify.com")) return raw
    return `${raw.replace(/\.myshopify\.com$/i, "")}.myshopify.com`
  }
  const getShopSubdomain = (value: string) => value.replace(/\.myshopify\.com$/i, "")

  const toLabel = (key: string) =>
    key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^\w/, (m) => m.toUpperCase())

  const awsRegions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-central-1", "ap-south-1",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  ]

  const guessCredentialType = (appName?: string | null) => {
    if (!appName) return ""
    const n = normalize(appName)
    const found = credentialTypes.find(ct => normalize(ct.key).includes(n) || n.includes(normalize(ct.key)))
    return found?.key || ""
  }

  const handleAppSelect = (app: { key: string; name: string }) => {
    setIsUpdateMode(false)
    setSelectedApp({ name: app.name, description: "", logo: "" } as any)
    setFormData((prev) => ({
      ...prev,
      app: app.key,
    }))
    // set exact credential type to schema key
    setCredentialType(app.key)
    setPropertyValues({})
    setShopifyConnectionStatus(null)
    setStep("form")
  }

  const resetForm = () => {
    setIsUpdateMode(false)
    setFormData({
      app: "",
      description: "",
    })
    setCredentialType("")
    setPropertyValues({})
    setGoogleOAuthState(null)
    setShopifyConnectionStatus(null)
    setIsShopifyAuthLoading(false)
    setIsShopifyStatusLoading(false)
    setIsShopifyDisconnecting(false)
  }

  // Check if credential type is Google OAuth
  const isGoogleOAuth = (type: string) => {
    const typeKey = type.toLowerCase()
    return /google.*oauth/i.test(type) || 
           typeKey.includes("googlesheets") || 
           typeKey.includes("googleads") || 
           typeKey.includes("googledocs") ||
           typeKey.includes("googledrive") ||
           typeKey.includes("googlecalendar") ||
           typeKey.includes("googleforms") ||
           typeKey.includes("googleslides") ||
           typeKey.includes("googlecontacts") ||
           typeKey.includes("googlebooks") ||
           typeKey.includes("googlephotos") ||
           typeKey.includes("youtube") ||
           typeKey.includes("googlebigquery") ||
           typeKey.includes("firebase") ||
           typeKey.includes("googlechat") ||
           typeKey.includes("perspective") || 
           typeKey.includes("gmail")
  }

  // Map credential type to Google service identifiers
  const getGoogleApps = (type: string): string[] => {
    const typeKey = type.toLowerCase()
    
    // Core Google Workspace
    if (typeKey.includes("sheets")) return ["sheets"]
    if (typeKey.includes("drive")) return ["drive"]
    if (typeKey.includes("gmail")) return ["gmail"]
    if (typeKey.includes("calendar")) return ["calendar"]
    if (typeKey.includes("docs")) return ["docs"]
    if (typeKey.includes("forms")) return ["forms"]
    if (typeKey.includes("slides")) return ["slides"]
    if (typeKey.includes("contacts")) return ["contacts"]
    
    // Media & Content
    if (typeKey.includes("books")) return ["books"]
    if (typeKey.includes("photos")) return ["photos"]
    if (typeKey.includes("youtube")) return ["youtube"]
    
    // Business & Advertising
    if (typeKey.includes("ads")) return ["ads"]
    if (typeKey.includes("business") && typeKey.includes("profile")) return ["business_profile"]
    
    // Google Cloud
    if (typeKey.includes("bigquery")) return ["bigquery"]
    if (typeKey.includes("cloud") && typeKey.includes("storage")) return ["cloud_storage"]
    if (typeKey.includes("natural") && typeKey.includes("language")) return ["cloud_natural_language"]
    if (typeKey.includes("firestore")) return ["firebase_firestore"]
    if (typeKey.includes("firebase") && typeKey.includes("realtime")) return ["firebase_realtime_db"]
    
    // Communication & AI
    if (typeKey.includes("chat")) return ["chat"]
    if (typeKey.includes("perspective")) return ["perspective"]
    
    // Generic Google OAuth
    if (typeKey.includes("google") && typeKey.includes("oauth")) {
      // Default to common services
      return ["sheets", "drive"]
    }
    
    // Default fallback
    return ["sheets", "drive"]
  }

  // Initiate Google OAuth flow
  const handleGoogleSignIn = async () => {
    if (!canWriteSecrets) {
      toast.error("Your plan does not allow creating or updating secrets.")
      return
    }
    if (!session?.user?.token) {
      toast("Please log in first")
      return
    }

    setIsGoogleAuthLoading(true)
    try {
      const apps = getGoogleApps(credentialType)
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/google-oauth/auth/google`,
        { 
          apps, 
          credential_type: credentialType, 
          use_popup: true,
          client_id: String(propertyValues.clientId || propertyValues.client_id || ""),
          client_secret: String(propertyValues.clientSecret || propertyValues.client_secret || "")
        },
        {
          headers: {
            Authorization: `Bearer ${session.user.token}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (response.data.auth_url && response.data.state) {
        setGoogleOAuthState(response.data.state)
        // Store state and timestamp in sessionStorage
        sessionStorage.setItem("google_oauth_state", response.data.state)
        sessionStorage.setItem("google_oauth_credential_type", credentialType)
        sessionStorage.setItem("google_oauth_timestamp", Date.now().toString())
        
        toast("Opening Google sign-in window...")
        
        // Open OAuth URL in popup with better parameters
        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2
        const popup = window.open(
          response.data.auth_url,
          "GoogleOAuth",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        )

        if (!popup) {
          toast.error("Popup blocked! Please allow popups for this site.")
          setIsGoogleAuthLoading(false)
          return
        }

        // Listen for OAuth completion with timeout
        let checkCount = 0
        const maxChecks = 240 // 2 minutes (240 * 500ms)
        
        const checkPopup = setInterval(() => {
          checkCount++
          
          if (popup.closed) {
            clearInterval(checkPopup)
            // Popup closed - data arrives via postMessage (use_popup flow) before close
            setIsGoogleAuthLoading(false)
          } else if (checkCount >= maxChecks) {
            // Timeout after 2 minutes
            clearInterval(checkPopup)
            popup.close()
            toast.error("OAuth timeout. Please try again.")
            setIsGoogleAuthLoading(false)
          }
        }, 500)
      }
    } catch (error: any) {
      console.error("Google OAuth error:", error)
      const errorMsg = error.response?.data?.error || error.message || "Failed to initiate Google OAuth"
      toast.error(errorMsg)
      setIsGoogleAuthLoading(false)
    }
  }

  const checkShopifyConnectionStatus = async (shopInput?: string) => {
    if (!session?.user?.token) {
      toast("Please log in first")
      return null
    }

    const shop = normalizeShopDomain(shopInput ?? String(propertyValues.shopSubdomain ?? ""))
    if (!shop) {
      toast("Enter Shop Subdomain first")
      return null
    }

    setIsShopifyStatusLoading(true)
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/secrets/oauth/shopify/status`, {
        params: { shop, organization_id: currentOrg?.id || undefined },
        headers: {
          Authorization: `Bearer ${session.user.token}`,
        },
      })

      setShopifyConnectionStatus(response.data)
      return response.data as ShopifyConnectionStatus
    } catch (error: any) {
      console.error("Failed to check Shopify status:", error)
      const errorMsg = error.response?.data?.error || error.message || "Failed to check Shopify connection"
      toast.error(errorMsg)
      return null
    } finally {
      setIsShopifyStatusLoading(false)
    }
  }

  const handleShopifyConnect = async () => {
    if (!canWriteSecrets) {
      toast.error("Your plan does not allow creating or updating secrets.")
      return
    }
    if (!session?.user?.token) {
      toast("Please log in first")
      return
    }

    const shop = normalizeShopDomain(String(propertyValues.shopSubdomain ?? ""))
    if (!shop) {
      toast("Enter Shop Subdomain first")
      return
    }

    setPropertyValues((prev) => ({ ...prev, shopSubdomain: getShopSubdomain(shop) }))
    setIsShopifyAuthLoading(true)
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          SHOPIFY_OAUTH_PENDING_KEY,
          JSON.stringify({
            credentialType: "shopifyOAuth2Api",
            shop,
            shopSubdomain: getShopSubdomain(shop),
            timestamp: Date.now(),
          })
        )
      }

      const returnUrl = typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : undefined

      const response = await axios.get(`${API_BASE_URL}/api/v1/secrets/oauth/shopify/authorize`, {
        params: {
          shop,
          return_url: returnUrl,
          organization_id: currentOrg?.id || undefined,
        },
        headers: {
          Authorization: `Bearer ${session.user.token}`,
        },
      })

      const authorizationUrl = response.data?.authorization_url
      if (!authorizationUrl) {
        throw new Error("Authorization URL missing from response")
      }

      window.location.href = authorizationUrl
    } catch (error: any) {
      console.error("Shopify OAuth authorize error:", error)
      const errorMsg = error.response?.data?.error || error.message || "Failed to start Shopify OAuth"
      toast.error(errorMsg)
      setIsShopifyAuthLoading(false)
    }
  }

  const handleShopifyDisconnect = async () => {
    if (!canDeleteSecrets) {
      toast.error("Your plan does not allow deleting secrets.")
      return
    }
    if (!session?.user?.token) {
      toast("Please log in first")
      return
    }

    const shop = normalizeShopDomain(String(propertyValues.shopSubdomain ?? shopifyConnectionStatus?.shop ?? ""))
    if (!shop) {
      toast("Enter Shop Subdomain first")
      return
    }

    setIsShopifyDisconnecting(true)
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/v1/secrets/oauth/shopify/disconnect`, {
        params: { shop, organization_id: currentOrg?.id || undefined },
        headers: {
          Authorization: `Bearer ${session.user.token}`,
        },
      })

      setShopifyConnectionStatus({
        connected: false,
        shop,
        organization_id: response.data?.organization_id ?? null,
      })
      setCredentials((prev) => prev.filter((cred) => !(cred.app === "shopify" && cred.name.endsWith(`_${shop}`))))
      toast.success(response.data?.message || "Shopify disconnected")
    } catch (error: any) {
      console.error("Shopify disconnect error:", error)
      const errorMsg = error.response?.data?.error || error.message || "Failed to disconnect Shopify"
      toast.error(errorMsg)
    } finally {
      setIsShopifyDisconnecting(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const provider = params.get("provider")
    if (provider !== "shopify") return

    const statusParam = params.get("status")
    const shop = params.get("shop")
    const scope = params.get("scope")
    const error = params.get("error") || params.get("message")

    if (statusParam === "success" && shop) {
      toast.success(`Shopify connected${scope ? ` (${scope})` : ""}`)

      const pendingRaw = sessionStorage.getItem(SHOPIFY_OAUTH_PENDING_KEY)
      let pending: any = null
      try {
        pending = pendingRaw ? JSON.parse(pendingRaw) : null
      } catch {
        pending = null
      }

      setCredentialType("shopifyOAuth2Api")
      setStep("form")
      setIsDialogOpen(true)
      setShopifyConnectionStatus({
        connected: true,
        shop,
        scope: scope || undefined,
        organization_id: params.get("organization_id"),
      })
      setPropertyValues((prev) => ({
        ...prev,
        shopSubdomain: pending?.shopSubdomain || getShopSubdomain(shop),
      }))

      sessionStorage.removeItem(SHOPIFY_OAUTH_PENDING_KEY)
    } else if (statusParam === "error") {
      toast.error(error || "Shopify connection failed")
    }

    const cleaned = new URL(window.location.href)
    ;["status", "provider", "shop", "scope", "organization_id", "error", "message"].forEach((key) => cleaned.searchParams.delete(key))
    window.history.replaceState({}, "", cleaned.toString())
    setIsShopifyAuthLoading(false)
  }, [])

  useEffect(() => {
    if (!session?.user?.token || !shopifyConnectionStatus?.shop || !shopifyConnectionStatus.connected) return
    checkShopifyConnectionStatus(shopifyConnectionStatus.shop)
  }, [session?.user?.token, shopifyConnectionStatus?.shop, shopifyConnectionStatus?.connected])


  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!canWriteSecrets) {
    toast.error("Your plan does not allow creating or updating secrets.")
    return
  }

  if (!credentialType) {
    toast("Please select a credential type")
    return
  }

  // Validate required fields from schema
    if (isShopifyOAuth(credentialType)) {
      toast("Shopify OAuth is saved via Connect with Shopify. Use the connect button instead.")
      return
    }

    const selectedDef = credentialTypes.find(ct => ct.key === credentialType)?.def
  const requiredFields = selectedDef?.required || []
  const missing = requiredFields.filter((key) => propertyValues[key] === undefined || propertyValues[key] === "")
  if (missing.length > 0) {
    toast(`Please fill required field(s): ${missing.join(", ")}`)
    return
  }

  setIsSubmitting(true)

  try {
    // Save each property as its own credential: app = credentialType, name = property key
    const entries = Object.entries(propertyValues)
    await Promise.all(entries.map(([propName, propValue]) => {
      return axios.put(
        `${API_BASE_URL}/api/v1/secrets/${credentialType}/${propName}`,
        {
          value: String(propValue ?? ""),
          description: formData.description,
          organization_id: currentOrg?.id || undefined,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      )
    }))

    // Refresh table locally by appending new rows
    const nowDate = new Date().toISOString().split("T")[0]
    const newRows: Credential[] = Object.entries(propertyValues).map(([propName, propValue]) => ({
      id: Date.now() + Math.random(),
      app: credentialType,
      name: propName,
      value: String(propValue ?? ""),
      description: formData.description,
      createdAt: nowDate,
    }))

    setCredentials((prev) => [...prev, ...newRows])
    setIsDialogOpen(false)
    resetForm()
    toast("Credential added successfully")
  } catch (error) {
    console.error(error)
    toast("Failed to add credential. Please try again.")
  } finally {
    setIsSubmitting(false)
  }
}


  const handleDeleteCredential = async (app: string, name: string) => {
  if (!canDeleteSecrets) {
    toast.error("Your plan does not allow deleting secrets.")
    return
  }
  try {
    await axios.delete(`${API_BASE_URL}/api/v1/secrets/${app}/${name}`, {
      params: {
        organization_id: currentOrg?.id || undefined,
      },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.user?.token}`,
      },
    });

    // Remove the credential from state
    setCredentials((prev) =>
      prev.filter((cred) => !(cred.app === app && cred.name === name))
    );

    toast("Credential deleted successfully");
  } catch (error) {
    console.error("Error deleting credential:", error);
    toast("Failed to delete credential");
  }
};

  const handleUpdateAppCredentials = async (app: string) => {
    if (!canWriteSecrets) {
      toast.error("Your plan does not allow updating secrets.")
      return
    }
    // Security: do NOT fetch or display decrypted values
    // Simply open the dialog for user to input new values
    const effectiveCredentialType = app === "shopify" ? "shopifyOAuth2Api" : app
    const shopDomainSecret = app === "shopify"
      ? credentials.find((cred) => cred.app === "shopify" && cred.name.startsWith("shop_domain_"))?.name
      : null
    const inferredShop = shopDomainSecret ? shopDomainSecret.replace(/^shop_domain_/, "") : ""

    setCredentialType(effectiveCredentialType)
    setPropertyValues({})
    if (inferredShop) {
      setPropertyValues({ shopSubdomain: getShopSubdomain(inferredShop) })
      setShopifyConnectionStatus({ connected: true, shop: inferredShop })
    } else {
      setShopifyConnectionStatus(null)
    }
    setFormData((prev) => ({ ...prev, app }))
    setIsUpdateMode(true)
    setStep("form")
    setIsDialogOpen(true)
  };

  const handleDeleteAppCredentials = async (app: string) => {
    if (!canDeleteSecrets) {
      toast.error("Your plan does not allow deleting secrets.")
      return
    }
    try {
      await axios.delete(`${API_BASE_URL}/api/v1/secrets/${app}`, {
        params: {
          organization_id: currentOrg?.id || undefined,
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.user?.token}`,
        },
      });

      // Remove all credentials for this app from state
      setCredentials((prev) => prev.filter((cred) => cred.app !== app));

      toast("All credentials for this app deleted successfully");
    } catch (error) {
      console.error("Error deleting app credentials:", error);
      toast("Failed to delete app credentials");
    }
  };

  const handleOpenShareDialog = (app: string) => {
    if (currentOrg) {
      toast.error("Switch to Personal Account scope to share credentials into an organization.")
      return
    }
    if (!shareableOrganizations.length) {
      toast.error("You need admin access to at least one organization to share credentials.")
      return
    }
    setSelectedShareApp(app)
    setShareTargetOrgId((prev) => prev || shareableOrganizations[0].id || "")
    setIsShareDialogOpen(true)
  }

  const handleShareAppCredentials = async () => {
    if (!selectedShareApp) return
    if (!shareTargetOrgId) {
      toast.error("Please select an organization.")
      return
    }
    if (!session?.user?.token) {
      toast.error("Please log in first.")
      return
    }

    setIsSharing(true)
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/secrets/${selectedShareApp}/share-to-organization`,
        { organization_id: shareTargetOrgId },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.user.token}`,
          },
        }
      )

      const copied = response?.data?.copied ?? 0
      const updated = response?.data?.updated ?? 0
      toast.success(
        `Shared ${copied + updated} secret${copied+updated === 1 ? "" : "s"} to organization (${copied} copied, ${updated} updated).`
      )
      setIsShareDialogOpen(false)
      setSelectedShareApp(null)
      setShareTargetOrgId("")
    } catch (error: any) {
      const message = error?.response?.data?.error || "Failed to share credentials to organization"
      toast.error(message)
    } finally {
      setIsSharing(false)
    }
  }

  const maskValue = (value: string | undefined | null): string => {
  if (!value) return "" // Handle undefined/null cases
  if (value.length <= 8) return "*".repeat(value.length)
  return `${value.substring(0, 4)}${"*".repeat(value.length - 8)}${value.substring(value.length - 4)}`
}

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetForm()
      setStep("select")
      setAppSearch("")
    }
  }

  const toggleValueVisibility = (id: number) => {
    setVisibleValues((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-bg font-generalSans">
  <div className="flex flex-col items-center text-center w-auto max-w-md">
    <Lock className="h-8 w-8 mb-2" />
    <h2 className="text-3xl font-semibold text-text-lm dark:text-text">Not Logged In</h2>
    <p className="text-text-muted-lm dark:text-text-muted">
      Please sign in to access credentials
    </p>
  </div>
  <Button onClick={() => signIn()} className="hover:bg-info hover:scale-105 hover:text-lg">Sign In</Button>
</div>
    );
  }

  if (loading && session) {
    return <LoadingLogo />
  }

  if (!canReadSecrets) {
    return <CreditsBlockedState title="Secrets unavailable" message="Your current plan does not include secrets access in this scope." />
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col bg-transparent py-8 font-generalSans">
      <div className="w-full min-w-0 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-lm dark:text-text sm:text-4xl">API &amp; Credentials</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted-lm dark:text-text-muted">
              Manage your API endpoints and secure credentials with encryption and access controls.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <OrgDropdown />
              <span className="text-xs text-text-muted-lm dark:text-text-muted">
                Scope: {currentOrg ? currentOrg.name : "Personal Account"}
              </span>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="h-12 shrink-0 rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] px-6 text-base font-generalSans font-semibold text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)] disabled:opacity-50"
                disabled={!canWriteSecrets}
              >
                <Plus className="mr-2 h-5 w-5" />
                Add New Secret
              </Button>
            </DialogTrigger>

      {/* STEP 1: Select App (from schema) */}
      {step === "select" && (
        <DialogContent className="max-h-[min(90vh,720px)] gap-0 overflow-hidden rounded-[4px] border border-zinc-200 bg-white p-0 shadow-2xl dark:border-zinc-800 dark:bg-bg-light sm:max-w-xl font-generalSans">
          <div className="border-b border-zinc-100 px-6 pb-4 pt-6 dark:border-zinc-800">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-2xl font-bold tracking-tight text-text-lm dark:text-text">Apps Available</DialogTitle>
              <DialogDescription className="text-sm text-text-muted-lm dark:text-text-muted">
                Select the app you would like to authenticate with.
              </DialogDescription>
            </DialogHeader>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search apps by name or key..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="h-11 rounded-xl border-zinc-200 bg-bg-light-lm pl-10 text-text-lm placeholder:text-text-muted-lm focus-visible:ring-primary-lm/30 dark:border-zinc-700 dark:bg-bg-light/80 dark:text-text"
              />
            </div>
          </div>
          <div className="max-h-[min(52vh,420px)] overflow-y-auto">
            {filteredAppTiles.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-text-muted-lm dark:text-text-muted">No apps match your search.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredAppTiles.map((app) => (
                  <li
                    key={app.key}
                    className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-bg-light-lm/80 dark:hover:bg-bg-light/50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-700 dark:bg-bg-light">
                        <AppLogo appKey={app.key} size={24} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-text-lm dark:text-text">{getDisplayNameFromKey(app.key)}</p>
                        <p className="mt-0.5 truncate font-mono text-xs text-text-muted-lm dark:text-text-muted">{app.key}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 font-medium text-slate-800 shadow-none hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      onClick={() => handleAppSelect(app)}
                    >
                      Add Credential
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Shield className="h-4 w-4 shrink-0 text-slate-400" />
              <span>All connections are encrypted end-to-end.</span>
            </div>
            <button
              type="button"
              className="text-left text-xs font-semibold text-[#1D61D1] hover:underline dark:text-blue-400 sm:text-right"
              onClick={() => toast.message("Contact support to request a new integration.")}
            >
              Don&apos;t see your app? Request integration
            </button>
          </div>
        </DialogContent>
      )}

      {/* STEP 2: Credential Form (from schema) */}
      {step === "form" && (
        <DialogContent className="max-h-[min(90vh,760px)] gap-0 overflow-y-auto rounded-[4px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-w-[560px]">
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="border-b border-slate-100 px-6 pb-4 pt-6 dark:border-slate-800">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {isUpdateMode ? `Update ${toTitle(credentialType)}` : `Add ${toTitle(credentialType)}`}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                  {isShopifyOAuth(credentialType)
                    ? "Connect your Shopify store using OAuth. The backend stores the encrypted token after callback."
                    : "Fill the required fields to securely store credentials."}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="grid gap-4 px-6 py-5">
              {/* Dynamic properties */}
              {credentialType && (
                <div className="grid gap-3">
                  {(() => {
                    const properties = Object.entries((credentialTypes.find(ct => ct.key === credentialType)?.def.properties) || {})
                    const isGoogleAuth = isGoogleOAuth(credentialType)
                    const isShopifyAuth = isShopifyOAuth(credentialType)
                    
                    // For Google OAuth, separate clientId/clientSecret from other fields
                    const priorityFields = ['clientId', 'clientSecret']
                    const shopifyHiddenFields = new Set([
                      "clientId",
                      "clientSecret",
                      "oauthTokenData",
                      "additionalBodyProperties",
                      "sendAdditionalBodyProperties",
                    ])
                    const visibleProperties = isShopifyAuth
                      ? properties.filter(([prop]) => !shopifyHiddenFields.has(prop))
                      : properties
                    const orderedProps = isGoogleAuth 
                      ? [
                          ...visibleProperties.filter(([prop]) => priorityFields.includes(prop)),
                          ...visibleProperties.filter(([prop]) => !priorityFields.includes(prop))
                        ]
                      : visibleProperties
                    
                    const renderField = ([prop, def]: [string, any], index: number) => {
                      const t = (def as any)?.type || "string"
                      const isSecret = /key|secret|token|password/i.test(prop)
                      const isJson = t === "json" || /data|properties/i.test(prop)
                      const inputType = t === "number" ? "number" : (t === "boolean" ? "checkbox" : (isSecret ? "password" : "text"))
                      const required = (credentialTypes.find(ct => ct.key === credentialType)?.def.required || []).includes(prop)
                      
                      // Skip notice fields
                      if (t === "notice") return null
                      
                      return (
                        <div key={prop} className="grid gap-2">
                          <Label htmlFor={`pv-${prop}`} className="text-text-lm dark:text-text">{toLabel(prop)}{required ? " *" : ""}</Label>
                          {inputType === "checkbox" ? (
                            <Switch
                              id={`pv-${prop}`}
                              checked={Boolean(propertyValues[prop])}
                              onCheckedChange={(val) => setPropertyValues(prev => ({ ...prev, [prop]: Boolean(val) }))}
                            />
                          ) : credentialType.toLowerCase().includes("aws") && prop === "region" ? (
                            <select
                              id={`pv-${prop}`}
                              value={String(propertyValues[prop] ?? "")}
                              onChange={(e) => setPropertyValues(prev => ({ ...prev, [prop]: e.target.value }))}
                              required={required}
                              className="w-full px-3 py-2 rounded-md border border-border-lm dark:border-border bg-bg-light-lm dark:bg-bg-light text-text-lm dark:text-text"
                            >
                              <option value="">Select region</option>
                              {awsRegions.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : isJson ? (
                            <Textarea
                              id={`pv-${prop}`}
                              placeholder={`Enter ${toLabel(prop)} (JSON format)`}
                              value={String(propertyValues[prop] ?? "")}
                              onChange={(e) => setPropertyValues(prev => ({ ...prev, [prop]: e.target.value }))}
                              required={required}
                              rows={6}
                              className="caret-text-lm dark:caret-text text-text-lm dark:text-text bg-bg-light-lm dark:bg-bg-light font-mono text-sm"
                            />
                          ) : (
                            <Input
                              id={`pv-${prop}`}
                              type={inputType}
                              placeholder={`Enter ${toLabel(prop)}`}
                              value={typeof propertyValues[prop] === "string" || typeof propertyValues[prop] === "number" ? String(propertyValues[prop] ?? "") : ""}
                              onChange={(e) => setPropertyValues(prev => ({ ...prev, [prop]: inputType === "number" ? Number(e.target.value) : e.target.value }))}
                              required={required}
                              className="caret-text-lm dark:caret-text text-text-lm dark:text-text bg-bg-light-lm dark:bg-bg-light"
                            />
                          )}
                        </div>
                      )
                    }
                    
                    const renderedFields = orderedProps.map((propEntry, index) => {
                      const [prop] = propEntry
                      const hasClientCreds = propertyValues.clientId && propertyValues.clientSecret
                      
                      // After rendering clientSecret for Google OAuth, show the Sign in button
                      if (isGoogleAuth && prop === 'clientSecret') {
                        return (
                          <React.Fragment key={prop}>
                            {renderField(propEntry, index)}
                            {/* Google OAuth Sign In Button */}
                            <div className="grid gap-3 p-4 bg-bg-light-lm dark:bg-bg-light rounded-lg border-2 border-border-lm dark:border-border shadow-sm">
                              <div className="flex flex-col gap-2">
                                <Label className="text-text-lm dark:text-text font-semibold flex items-center gap-2">
                                  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                  </svg>
                                  Get OAuth Tokens from Google
                                </Label>
                                <p className="text-sm text-text-muted-lm dark:text-text-muted">
                                  Click below to authenticate and auto-fill OAuth token data
                                </p>
                                <Button
                                  type="button"
                                  onClick={handleGoogleSignIn}
                                  disabled={isGoogleAuthLoading || !hasClientCreds || !canWriteSecrets}
                                  className="w-full bg-bg-light-lm dark:bg-bg-light hover:bg-bg-lm dark:hover:bg-bg text-text-lm dark:text-text border-2 border-border-lm dark:border-border shadow-md flex items-center justify-center gap-2 py-6 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                  </svg>
                                  {isGoogleAuthLoading ? "Signing in..." : hasClientCreds ? "Sign in with Google" : "Enter Client ID & Secret first"}
                                </Button>
                                {!hasClientCreds && (
                                  <p className="text-xs text-warning-lm dark:text-warning text-center">
                                    ⚠️ Please fill in Client ID and Client Secret above first
                                  </p>
                                )}
                              </div>
                            </div>
                          </React.Fragment>
                        )
                      }
                      
                      return renderField(propEntry, index)
                    })

                    if (!isShopifyAuth) return renderedFields

                    const currentShopDomain = normalizeShopDomain(String(propertyValues.shopSubdomain ?? shopifyConnectionStatus?.shop ?? ""))
                    const currentScope = shopifyConnectionStatus?.scope

                    return (
                      <>
                        {renderedFields}
                        <div className="grid gap-3 p-4 bg-bg-light-lm dark:bg-bg-light rounded-lg border border-border-lm dark:border-border shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <Label className="text-text-lm dark:text-text font-semibold">Shopify OAuth Connection</Label>
                            <Badge variant={shopifyConnectionStatus?.connected ? "default" : "secondary"}>
                              {shopifyConnectionStatus?.connected ? "Connected" : "Not connected"}
                            </Badge>
                          </div>
                          <p className="text-sm text-text-muted-lm dark:text-text-muted">
                            Connect this shop via Shopify OAuth. Tokens are stored by the backend under the `shopify` app secrets.
                          </p>
                          {currentShopDomain && (
                            <div className="text-xs text-text-lm dark:text-text bg-bg-lm dark:bg-bg border border-border-lm dark:border-border rounded-md px-3 py-2">
                              Shop: <span className="font-medium">{currentShopDomain}</span>
                              {currentScope ? <span className="ml-2">Scope: {currentScope}</span> : null}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={handleShopifyConnect}
                              disabled={isShopifyAuthLoading || !currentShopDomain || !canWriteSecrets}
                              className="bg-bg-light-lm dark:bg-bg-light hover:bg-bg-lm dark:hover:bg-bg text-text-lm dark:text-text border border-border-lm dark:border-border"
                              variant="outline"
                            >
                              {isShopifyAuthLoading ? "Redirecting..." : "Connect with Shopify"}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => checkShopifyConnectionStatus()}
                              disabled={isShopifyStatusLoading || !currentShopDomain}
                              variant="outline"
                            >
                              {isShopifyStatusLoading ? "Checking..." : "Check Status"}
                            </Button>
                            <Button
                              type="button"
                              onClick={handleShopifyDisconnect}
                              disabled={isShopifyDisconnecting || !currentShopDomain || !shopifyConnectionStatus?.connected || !canDeleteSecrets}
                              variant="outline"
                              className="text-danger-lm dark:text-danger border-danger-lm dark:border-danger hover:bg-danger-lm/10 dark:hover:bg-danger/10"
                            >
                              {isShopifyDisconnecting ? "Disconnecting..." : "Disconnect"}
                            </Button>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}

              {!isShopifyOAuth(credentialType) && (
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-text-lm dark:text-text">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this credential"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  rows={3}
                  className="caret-text-lm dark:caret-text text-text-lm dark:text-text bg-bg-light-lm dark:bg-bg-light border-border-lm dark:border-border"
                />
              </div>
              )}
            </div>
            <DialogFooter className="gap-2 border-t border-zinc-100 bg-bg-light-lm/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/50 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm()
                  setStep("select")
                }}
                className="rounded-xl border-zinc-200 bg-white text-text-muted-lm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-bg-light dark:text-text-muted dark:hover:bg-zinc-800"
              >
                Back
              </Button>
              {!isShopifyOAuth(credentialType) && (
                <Button
                  type="submit"
                  className="rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] font-generalSans font-semibold text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]"
                  disabled={!canWriteSecrets}
                >
                  {isSubmitting ? (isUpdateMode ? "Updating..." : "Adding...") : (isUpdateMode ? "Update" : "Add Credential")}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      )}
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid gap-6 lg:grid-cols-3 font-generalSans">
          <div className="flex flex-col justify-center rounded-[4px]  bg-transparent shadow-sm  dark:bg-transparent lg:col-span-2 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted-lm dark:text-text-muted sm:text-sm">
              Active credentials
            </p>
            <div className="mt-6 flex flex-col gap-8 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
              <div className="min-w-0 space-y-2 sm:space-y-3">
                <p className="text-5xl font-bold leading-none tracking-tight text-text-lm dark:text-text sm:text-6xl lg:text-7xl">
                  {appGroups.length}
                </p>
                <p className="max-w-md text-base leading-snug text-text-muted-lm dark:text-text-muted sm:text-lg">
                  Integration hub{appGroups.length !== 1 ? "s" : ""} · {credentials.length} stored secret
                  {credentials.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex shrink-0 -space-x-3 sm:-space-x-4">
                {appGroups.slice(0, 5).map((g) => (
                  <div
                    key={g.app}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-white bg-zinc-100 shadow-md ring-1 ring-zinc-200/80 dark:border-zinc-950 dark:bg-bg-light dark:ring-zinc-800/80 sm:h-16 sm:w-16"
                  >
                    <AppLogo appKey={g.app} size={36} />
                  </div>
                ))}
                {appGroups.length > 5 && (
                  <div className="flex h-14 w-16 min-w-[3.5rem] items-center justify-center rounded-2xl border-[3px] border-white bg-zinc-200 text-sm font-bold text-text-lm shadow-md ring-1 ring-zinc-200/80 dark:border-zinc-950 dark:bg-zinc-800 dark:text-text dark:ring-zinc-800/80 sm:h-16 sm:min-w-[4rem] sm:text-base">
                    +{appGroups.length - 5}
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>

        {/* Credentials table */}
        <div className="overflow-hidden rounded-[4px] border border-zinc-200 bg-bg-light-lm shadow-sm dark:border-zinc-800 dark:bg-bg-light">
          <div className="flex flex-col gap-4 border-b border-zinc-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-text-muted-lm dark:text-text-muted" />
              <div>
                <h2 className="text-lg font-bold text-text-lm dark:text-text">Credentials</h2>
                <p className="text-xs text-text-muted-lm dark:text-text-muted">Expand a row to see individual secret keys</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Filter">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </Button>
              <Button type="button" variant="ghost" size="icon" className="rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Sort">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto px-2 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-100 hover:bg-transparent dark:border-zinc-800">
                  <TableHead className="w-12 font-semibold text-text-muted-lm dark:text-text-muted" />
                  <TableHead className="font-semibold text-text-muted-lm dark:text-text-muted">App</TableHead>
                  <TableHead className="font-semibold text-text-muted-lm dark:text-text-muted">Secrets count</TableHead>
                  <TableHead className="font-semibold text-text-muted-lm dark:text-text-muted">Description</TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-text-muted-lm dark:text-text-muted">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center">
                      <Lock className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No credentials yet</p>
                      <p className="mt-1 text-sm text-slate-500">Add a secret to connect your first integration.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  appGroups.map((appGroup) => (
                    <React.Fragment key={appGroup.app}>
                      <TableRow className="border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-bg-light/30">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAppExpansion(appGroup.app)}
                            className="h-8 w-8 p-0 text-text-muted-lm dark:text-text-muted"
                          >
                            {expandedApps.has(appGroup.app) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium text-text-lm dark:text-text">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                              <AppLogo appKey={appGroup.app} size={18} />
                            </div>
                            <div>
                              <span>{getDisplayNameFromKey(appGroup.app)}</span>
                              <p className="text-xs font-normal text-text-muted-lm dark:text-text-muted">Credential type · {appGroup.app}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="rounded-full border-0 bg-orange-100 px-2.5 py-0.5 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
                            {appGroup.credentials.length} secret{appGroup.credentials.length !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-slate-600 dark:text-slate-400">
                          {appGroup.credentials[0]?.description || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-bg-light-lm dark:bg-bg-light  rounded-[4px] shadow-lg p-0 min-w-[140px] overflow-hidden"
                            >
                              <DropdownMenuItem
                                disabled={Boolean(currentOrg) || !shareableOrganizations.length || !canWriteSecrets}
                                onClick={() => handleOpenShareDialog(appGroup.app)}
                                className="w-full font-generalSans text-sm font-medium text-text-lm dark:text-text cursor-pointer focus:bg-bg-lm dark:focus:bg-bg rounded-none px-2 py-2"
                              >
                                <Share2 className="mr-2 h-4 w-4" />
                                Share to org
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canWriteSecrets}
                                onClick={() => handleUpdateAppCredentials(appGroup.app)}
                                className="w-full font-generalSans text-sm font-medium text-text-lm dark:text-text cursor-pointer focus:bg-bg-lm dark:focus:bg-bg rounded-none px-2 py-2"
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Update
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canDeleteSecrets}
                                className="w-full font-generalSans text-sm font-medium text-danger-lm dark:text-danger hover:bg-danger-lm/15 dark:hover:bg-danger/20 cursor-pointer focus:bg-danger-lm/15 dark:focus:bg-danger/20 rounded-none px-2 py-2"
                                onClick={() => handleDeleteAppCredentials(appGroup.app)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete all
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {expandedApps.has(appGroup.app) &&
                        appGroup.credentials.map((credential) => (
                          <TableRow
                            key={`${credential.app}-${credential.name}`}
                            className="border-zinc-100 bg-white dark:border-zinc-800 dark:bg-bg-light/80"
                          >
                            <TableCell />
                            <TableCell colSpan={2} className="pl-12">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                                <code className="text-sm font-mono font-medium text-text-lm dark:text-text-muted">{credential.name}</code>
                                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>Added {credential.createdAt || "—"}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-text-muted-lm dark:text-text-muted">
                              {visibleValues.has(credential.id)
                                ? credential.value || "—"
                                : maskValue(credential.value) || "••••••••"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  className="text-sm font-semibold text-primary-lm hover:underline dark:text-primary"
                                  onClick={() => toggleValueVisibility(credential.id)}
                                >
                                  {visibleValues.has(credential.id) ? "Hide" : "View"}
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="bg-bg-light-lm dark:bg-bg-light  rounded-[4px] shadow-lg p-0 min-w-[120px] overflow-hidden"
                                  >
                                    <DropdownMenuItem
                                      disabled={!canDeleteSecrets}
                                      className="w-full font-generalSans text-sm font-medium text-danger-lm dark:text-danger hover:bg-danger-lm/15 dark:hover:bg-danger/20 cursor-pointer focus:bg-danger-lm/15 dark:focus:bg-danger/20 rounded-none px-2 py-2"
                                      onClick={() => handleDeleteCredential(credential.app, credential.name)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {appGroups.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-zinc-100 px-5 py-4 text-sm text-text-muted-lm dark:border-zinc-800 dark:text-text-muted sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {appGroups.length} connected application{appGroups.length !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled>
                  Previous
                </Button>
                <Button type="button" size="sm" className="rounded-lg bg-primary-lm text-white hover:opacity-90 dark:bg-primary" disabled>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[4px]">
          <DialogHeader>
            <DialogTitle>Share Credentials to Organization</DialogTitle>
            <DialogDescription>
              Copy all personal credentials for <span className="font-semibold">{selectedShareApp || "this app"}</span> into an organization where you are an admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="share-org-select">Organization</Label>
            <Select value={shareTargetOrgId} onValueChange={setShareTargetOrgId}>
              <SelectTrigger id="share-org-select" className="w-full">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {shareableOrganizations.map((org: any) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-[4px]"
              onClick={() => setIsShareDialogOpen(false)}
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-[4px]"
              onClick={handleShareAppCredentials}
              disabled={isSharing || !shareTargetOrgId}
            >
              {isSharing ? "Sharing..." : "Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Page

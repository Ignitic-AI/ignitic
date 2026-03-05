"use client"

import {useState, useEffect, useMemo} from "react"
import { Plus, Key, Trash2, Edit, Lock, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import React from "react";
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
import { toast } from "sonner"
import axios from "axios"
import { useSession, signIn} from "next-auth/react"
import { AppLogo, getDisplayNameFromKey } from "./appLogos"
import schema from "./n8n_credentials_schema.json"
import { LoadingLogo } from "@/components/Loading"
import { useCredits } from "@/context/credits-context"
import { CreditsBlockedState } from "@/components/credits/CreditsBlockedState"

const API_BASE_URL = "http://localhost:8080"
const SHOPIFY_OAUTH_PENDING_KEY = "shopify_oauth_pending"
// Build app tiles directly from schema top-level keys
const toTitle = (key: string) => key
  .replace(/Api$/i, "")
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/[_-]+/g, " ")
  .replace(/^\w/, (m) => m.toUpperCase())

type SchemaApp = { key: string; name: string; description?: string; logo?: any }

// Mock data for API List
const apiList = [
  {
    id: 1,
    name: "Payment Gateway API",
    endpoint: "https://api.payments.com/v1",
    status: "Active",
    method: "REST",
    version: "v1.2",
  },
  {
    id: 2,
    name: "User Authentication API",
    endpoint: "https://auth.service.com/api",
    status: "Active",
    method: "GraphQL",
    version: "v2.0",
  },
  {
    id: 3,
    name: "Email Service API",
    endpoint: "https://mail.provider.com/send",
    status: "Inactive",
    method: "REST",
    version: "v1.0",
  },
  
]



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
  const canReadSecrets = hasFeature("secrets.read")
  const canWriteSecrets = hasFeature("secrets.write")
  const canDeleteSecrets = hasFeature("secrets.delete")

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())
  const appTiles: SchemaApp[] = useMemo(() => {
    const entries = Object.entries(schema as Record<string, any>)
    return entries.map(([key]) => ({
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

  useEffect(() => {
    if (!session?.user?.token) return

    const fetchSecrets = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/v1/secrets/user/all`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${session.user.token}`,
            },
          }
        )
        setCredentials(response.data.secrets || [])
      } catch (error) {
        console.error("Failed to fetch secrets:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSecrets()
  }, [session?.user?.token])

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
        axios
          .get(`${API_BASE_URL}/api/v1/secrets/user/all`, {
            headers: { Authorization: `Bearer ${session.user.token}` },
          })
          .then((res) => setCredentials(res.data.secrets || []))
          .catch(() => {})
      }
    } else if (status === "error") {
      toast.error(errorMsg || "Google OAuth failed")
      cleanUrl()
    }
  }, [session?.user?.token])

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
    return Object.entries(schema as Record<string, SchemaDef>).map(([key, def]) => ({ key, def }))
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
        { apps, credential_type: credentialType, use_popup: true },
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
        params: { shop },
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
        params: { shop },
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

  const maskValue = (value: string | undefined | null): string => {
  if (!value) return "" // Handle undefined/null cases
  if (value.length <= 8) return "*".repeat(value.length)
  return `${value.substring(0, 4)}${"*".repeat(value.length - 8)}${value.substring(value.length - 4)}`
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

  {/*Skeleton */}
  if (loading && session) {
  return (
    <LoadingLogo/>
    // <div className="container mx-auto p-6 space-y-8">
    //   {/* Main header */}
    //   <div className="space-y-2">
    //     <Skeleton className="h-8 w-[300px]" />
    //     <Skeleton className="h-5 w-[400px]" />
    //   </div>

    //   {/* Credentials section */}
    //   <div className="space-y-4">
    //     {/* Section header */}
    //     <div className="flex items-center justify-between">
    //       <div className="space-y-2">
    //         <Skeleton className="h-7 w-[150px]" />
    //         <Skeleton className="h-4 w-[250px]" />
    //       </div>
    //       <Skeleton className="h-9 w-[100px]" />
    //     </div>

    //     {/* Table skeleton */}
    //     <div className="space-y-2">
    //       {/* Table header row */}
    //       <div className="flex gap-4">
    //         <Skeleton className="h-10 w-1/4" />
    //         <Skeleton className="h-10 w-1/4" />
    //         <Skeleton className="h-10 w-1/4" />
    //         <Skeleton className="h-10 w-1/4" />
    //       </div>
          
    //       {/* Table data rows */}
    //       {[...Array(2)].map((_, i) => (
    //         <div key={i} className="flex gap-4">
    //           <Skeleton className="h-16 w-1/4" />
    //           <Skeleton className="h-16 w-1/4" />
    //           <Skeleton className="h-16 w-1/4" />
    //           <Skeleton className="h-16 w-1/4" />
    //         </div>
    //       ))}
    //     </div>
    //   </div>

    //   {/* API List section */}
    //   <div className="space-y-4">
    //     {/* Section header */}
    //     <div className="space-y-2">
    //       <Skeleton className="h-7 w-[150px]" />
    //       <Skeleton className="h-4 w-[250px]" />
    //     </div>

    //     {/* API items */}
    //     <div className="space-y-4">
    //       {[...Array(2)].map((_, i) => (
    //         <div key={i} className="space-y-2">
    //           <Skeleton className="h-5 w-[200px]" />
    //           <Skeleton className="h-4 w-[300px]" />
    //           <div className="flex gap-2">
    //             <Skeleton className="h-4 w-10" />
    //             <Skeleton className="h-4 w-10" />
    //           </div>
    //         </div>
    //       ))}
    //     </div>
    //   </div>
    // </div>
  )
}

  if (!canReadSecrets) {
    return <CreditsBlockedState title="Secrets unavailable" message="Your current plan does not include secrets access in this scope." />
  }

  return (
    <div className="container mx-auto p-6 space-y-8 font-generalSans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-lm dark:text-text">API & Credentials</h1>
          <p className="text-text-muted-lm dark:text-text-muted">Manage your API endpoints and secure credentials</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">

        {/* Credentials Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Key className="h-7 w-7" />
                  Credentials
                </CardTitle>
                <CardDescription>Manage your API keys and secrets</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-md" disabled={!canWriteSecrets}>
          <Plus className="h-4 w-4 mr-1" />
          Add New
        </Button>
      </DialogTrigger>

      {/* STEP 1: Select App (from schema) */}
      {step === "select" && (
        <DialogContent className="sm:max-w-[640px] bg-bg-lm dark:bg-bg font-generalSans max-h-[70vh] overflow-hidden border border-border-lm dark:border-border text-text-lm dark:text-text">
          <DialogHeader>
            <DialogTitle className="text-text-lm dark:text-text text-2xl">Apps Available</DialogTitle>
            <DialogDescription className="text-text-muted-lm dark:text-text-muted">
              Select the app you would like to authenticate with.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              placeholder="Search apps by name or key..."
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              className="bg-bg-light-lm dark:bg-bg-light text-text-lm dark:text-text border-border-lm dark:border-border mb-2"
            />
          </div>
          <div className="grid gap-2 max-h-[54vh] overflow-y-auto pr-1">
            {filteredAppTiles.map((app) => (
  <div
    key={app.key}
    className="border p-3 rounded-lg flex justify-between items-center bg-bg-light-lm dark:bg-bg-light backdrop-blur cursor-pointer hover:bg-bg-lm dark:hover:bg-bg border-border-lm dark:border-border"
    onClick={() => handleAppSelect(app)}
  >
    {/* Left section: Logo + Name/Description */}
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 overflow-hidden rounded bg-transparent flex items-center justify-center">
        <AppLogo appKey={app.key} size={24} />
      </div>
      <div>
        <h4 className="font-semibold text-text-lm dark:text-text">{getDisplayNameFromKey(app.key)}</h4>
        <p className="text-[10px] text-text-muted-lm dark:text-text-muted">Schema key: {app.key}</p>
      </div>
    </div>

    {/* Right section: Button */}
    <Button size="sm" className="bg-primary-lm dark:bg-primary text-bg-light-lm dark:text-text">Add Credential</Button>
    
  </div>
))}

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="text-bg-light-lm dark:text-text bg-danger-lm dark:bg-danger border-none">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {/* STEP 2: Credential Form (from schema) */}
      {step === "form" && (
        <DialogContent className="sm:max-w-[560px] bg-bg-lm dark:bg-bg font-generalSans max-h-[80vh] overflow-y-auto border border-border-lm dark:border-border text-text-lm dark:text-text">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-text-lm dark:text-text">{isUpdateMode ? `Update Credentials for ${toTitle(credentialType)}` : `Add New Credential for ${toTitle(credentialType)}`}</DialogTitle>
              <DialogDescription className="text-text-muted-lm dark:text-text-muted">
                {isShopifyOAuth(credentialType)
                  ? "Connect your Shopify store using OAuth. The backend stores the encrypted token after callback."
                  : "Fill the required fields to securely store credentials."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
    resetForm();
    setStep("select"); 
  }}
                className="text-text-lm dark:text-text bg-danger-lm dark:bg-danger"
              >
                Back
              </Button>
              {!isShopifyOAuth(credentialType) && (
                <Button
                  type="submit"
                  className="text-text bg-success hover:bg-text hover:text-primary transition-colors duration-100"
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
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold w-[50px]"></TableHead>
                  <TableHead className="font-semibold">App</TableHead>
                  <TableHead className="font-semibold">Secrets Count</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="w-[100px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appGroups.length === 0 ? (
  <TableRow>
    <TableCell colSpan={5} className="h-18 text-center dark:text-text-muted text-muted-lm text-xl">
      No Credentials Yet
    </TableCell>
  </TableRow>
) : (
  appGroups.map((appGroup) => (
    <React.Fragment key={appGroup.app}>
      {/* App Group Row */}
      <TableRow className="bg-muted/30">
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleAppExpansion(appGroup.app)}
            className="h-6 w-6 p-0"
          >
            {expandedApps.has(appGroup.app) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 overflow-hidden rounded bg-blue-100 flex items-center justify-center">
              <AppLogo appKey={appGroup.app} size={16} />
            </div>
            {getDisplayNameFromKey(appGroup.app)}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary">
            {appGroup.credentials.length} secret
            {appGroup.credentials.length !== 1 ? "s" : ""}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {appGroup.credentials[0]?.description || "No description"}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!canWriteSecrets}
                onClick={() => handleUpdateAppCredentials(appGroup.app)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Update
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canDeleteSecrets}
                className="text-destructive"
                onClick={() => handleDeleteAppCredentials(appGroup.app)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Expanded credentials */}
      {expandedApps.has(appGroup.app) &&
        appGroup.credentials.map((credential) => (
          <TableRow
            key={`${credential.app}-${credential.name}`}
            className="bg-muted/10"
          >
            <TableCell></TableCell>
            <TableCell className="pl-8 text-sm text-muted-foreground">
              {credential.name}
            </TableCell>
            <TableCell></TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {credential.description || "No description"}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!canDeleteSecrets}
                    className="text-destructive"
                    onClick={() =>
                      handleDeleteCredential(credential.app, credential.name)
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
    </React.Fragment>
  ))
)}

              </TableBody>
            </Table>
          </CardContent>
        </Card>

        

        
      </div>
    </div>
  )
}

export default Page

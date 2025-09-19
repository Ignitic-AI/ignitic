"use client"

import {useState, useEffect, useMemo} from "react"
import { Plus, Key, Globe, Trash2, Edit, Eye, EyeOff, Lock, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image"
import { AppLogo, getDisplayNameFromKey } from "./appLogos"
import schema from "./n8n_credentials_schema.json"

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

const Page = () => {
  const { data: session, status } = useSession()

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

  useEffect(() => {
    if (!session?.user?.token) return

    const fetchSecrets = async () => {
      try {
        const response = await axios.get(
          `http://localhost:8080/api/v1/secrets/user/all`,
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

  
  // Form state
  const [formData, setFormData] = useState({
    app: "",
    description: "",
  })
  const [credentialType, setCredentialType] = useState<string>("")
  const [propertyValues, setPropertyValues] = useState<Record<string, string | boolean | number>>({})

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
    setSelectedApp({ name: app.name, description: "", logo: "" } as any)
    setFormData((prev) => ({
      ...prev,
      app: app.key,
    }))
    // set exact credential type to schema key
    setCredentialType(app.key)
    setPropertyValues({})
    setStep("form")
  }

  const resetForm = () => {
    setFormData({
      app: "",
      description: "",
    })
    setCredentialType("")
    setPropertyValues({})
  }


  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!credentialType) {
    toast("Please select a credential type")
    return
  }

  // Validate required fields from schema
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
        `http://localhost:8080/api/v1/secrets/${credentialType}/${propName}`,
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
  try {
    await axios.delete(`http://localhost:8080/api/v1/secrets/${app}/${name}`, {
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
    try {
      // Fetch current secrets for this app
      const response = await axios.get(
        `http://localhost:8080/api/v1/secrets/${app}/values`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      );

      // Update the credentials in state with the fetched values
      const appSecrets = response.data.secrets || []
      setCredentials((prev) => {
        // Remove existing credentials for this app
        const filtered = prev.filter(cred => cred.app !== app)
        // Add the new ones
        const newCredentials = appSecrets.map((secret: any) => ({
          id: Date.now() + Math.random(),
          app: secret.app,
          name: secret.name,
          value: secret.value,
          description: secret.description || "",
          createdAt: secret.created_at || new Date().toISOString().split("T")[0],
        }))
        return [...filtered, ...newCredentials]
      })

      toast("Credentials updated successfully");
    } catch (error) {
      console.error("Error updating credentials:", error);
      toast("Failed to update credentials");
    }
  };

  const handleDeleteAppCredentials = async (app: string) => {
    try {
      await axios.delete(`http://localhost:8080/api/v1/secrets/${app}`, {
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
    <h2 className="text-3xl font-semibold ">Not Logged In</h2>
    <p className="text-muted-foreground">
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
    <div className="container mx-auto p-6 space-y-8">
      {/* Main header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-[300px]" />
        <Skeleton className="h-5 w-[400px]" />
      </div>

      {/* Credentials section */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-[150px]" />
            <Skeleton className="h-4 w-[250px]" />
          </div>
          <Skeleton className="h-9 w-[100px]" />
        </div>

        {/* Table skeleton */}
        <div className="space-y-2">
          {/* Table header row */}
          <div className="flex gap-4">
            <Skeleton className="h-10 w-1/4" />
            <Skeleton className="h-10 w-1/4" />
            <Skeleton className="h-10 w-1/4" />
            <Skeleton className="h-10 w-1/4" />
          </div>
          
          {/* Table data rows */}
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-16 w-1/4" />
              <Skeleton className="h-16 w-1/4" />
              <Skeleton className="h-16 w-1/4" />
              <Skeleton className="h-16 w-1/4" />
            </div>
          ))}
        </div>
      </div>

      {/* API List section */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-[150px]" />
          <Skeleton className="h-4 w-[250px]" />
        </div>

        {/* API items */}
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-[200px]" />
              <Skeleton className="h-4 w-[300px]" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

  return (
    <div className="container mx-auto p-6 space-y-8 font-generalSans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text">API & Credentials</h1>
          <p className="text-muted-foreground">Manage your API endpoints and secure credentials</p>
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
        <Button size="sm" className="bg-primary text-md">
          <Plus className="h-4 w-4 mr-1" />
          Add New
        </Button>
      </DialogTrigger>

      {/* STEP 1: Select App (from schema) */}
      {step === "select" && (
        <DialogContent className="sm:max-w-[640px] bg-[#ecf5ff] font-generalSans max-h-[70vh] overflow-hidden border border-blue-200 text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-text text-2xl">Apps Available</DialogTitle>
            <DialogDescription className="text-dHighlight">
              Select the app you would like to authenticate with.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              placeholder="Search apps by name or key..."
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              className="bg-white text-slate-900 mb-2"
            />
          </div>
          <div className="grid gap-2 max-h-[54vh] overflow-y-auto pr-1">
            {filteredAppTiles.map((app) => (
  <div
    key={app.key}
    className="border p-3 rounded-lg flex justify-between items-center bg-white/70 backdrop-blur cursor-pointer hover:bg-blue-50 border-blue-100"
    onClick={() => handleAppSelect(app)}
  >
    {/* Left section: Logo + Name/Description */}
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 overflow-hidden rounded bg-blue-100 flex items-center justify-center">
        <AppLogo appKey={app.key} size={24} />
      </div>
      <div>
        <h4 className="font-semibold text-slate-900">{getDisplayNameFromKey(app.key)}</h4>
        <p className="text-[10px] text-slate-600">Schema key: {app.key}</p>
      </div>
    </div>

    {/* Right section: Button */}
    <Button size="sm" className="bg-bg">Add Credential</Button>
    
  </div>
))}

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="text-text bg-danger">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {/* STEP 2: Credential Form (from schema) */}
      {step === "form" && (
        <DialogContent className="sm:max-w-[560px] bg-[#ecf5ff] font-generalSans max-h-[80vh] overflow-y-auto border border-blue-200 text-slate-900">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-slate-900">Add New Credential for {toTitle(credentialType)}</DialogTitle>
              <DialogDescription className="text-slate-600">Fill the required fields to securely store credentials.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Dynamic properties */}
              {credentialType && (
                <div className="grid gap-3">
                  {Object.entries((credentialTypes.find(ct => ct.key === credentialType)?.def.properties) || {}).map(([prop, def]) => {
                    const t = (def as any)?.type || "string"
                    const isSecret = /key|secret|token|password/i.test(prop)
                    const inputType = t === "number" ? "number" : (t === "boolean" ? "checkbox" : (isSecret ? "password" : "text"))
                    const required = (credentialTypes.find(ct => ct.key === credentialType)?.def.required || []).includes(prop)
                    return (
                      <div key={prop} className="grid gap-2">
                        <Label htmlFor={`pv-${prop}`} className="text-slate-800">{toLabel(prop)}{required ? " *" : ""}</Label>
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
                            className="w-full px-3 py-2 rounded-md border bg-white text-slate-900"
                          >
                            <option value="">Select region</option>
                            {awsRegions.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`pv-${prop}`}
                            type={inputType}
                            placeholder={`Enter ${toLabel(prop)}`}
                            value={typeof propertyValues[prop] === "string" || typeof propertyValues[prop] === "number" ? String(propertyValues[prop] ?? "") : ""}
                            onChange={(e) => setPropertyValues(prev => ({ ...prev, [prop]: inputType === "number" ? Number(e.target.value) : e.target.value }))}
                            required={required}
                            className="caret-slate-900 text-slate-900 bg-white"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-slate-800">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this credential"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  rows={3}
                  className="caret-slate-900 text-slate-900 bg-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
    resetForm();
    setStep("select"); 
  }}
                className="text-text bg-danger"
              >
                Back
              </Button>
              <Button type="submit" className="text-text bg-success hover:bg-text hover:text-primary transition-colors duration-100">
                {isSubmitting ? "Adding..." : "Add Credential"}
              </Button>
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
                {appGroups.map((appGroup) => (
                  <>
                    {/* App Group Row */}
                    <TableRow key={appGroup.app} className="bg-muted/30">
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
                          {appGroup.credentials.length} secret{appGroup.credentials.length !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {appGroup.credentials[0]?.description || 'No description'}
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
                              onClick={() => handleUpdateAppCredentials(appGroup.app)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Update
                            </DropdownMenuItem>
                            <DropdownMenuItem
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
                    
                    {/* Expanded Secrets Rows */}
                    {expandedApps.has(appGroup.app) && appGroup.credentials.map((credential) => (
                      <TableRow key={`${credential.app}-${credential.name}`} className="bg-muted/10">
                        <TableCell></TableCell>
                        <TableCell className="pl-8 text-sm text-muted-foreground">
                          {credential.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {visibleValues.has(credential.id) ? credential.value : maskValue(credential.value)}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setVisibleValues(prev => {
                                  const newSet = new Set(prev)
                                  if (newSet.has(credential.id)) {
                                    newSet.delete(credential.id)
                                  } else {
                                    newSet.add(credential.id)
                                  }
                                  return newSet
                                })
                              }}
                              className="h-6 w-6 p-0"
                            >
                              {visibleValues.has(credential.id) ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {credential.description || 'No description'}
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
                                className="text-destructive"
                                onClick={() => handleDeleteCredential(credential.app, credential.name)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        

        
      </div>
    </div>
  )
}

export default Page

"use client"

import {useState, useEffect} from "react"
import { Plus, Key, Globe, Trash2, Edit, Eye, EyeOff,Lock } from "lucide-react"
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
import { toast } from "sonner"
import axios from "axios"
import { useSession, signIn} from "next-auth/react"
import { Skeleton } from "@/components/ui/skeleton";
import Shopify from "../../../../public/logos/shopify.svg"
import Wix from "../../../../public/logos/wix-logo-1.svg"
import Image from "next/image"
import Google from "../../../../public/logos/google-icon.svg"
import Sheets from "../../../../public/logos/google-spreadsheets.svg"

// Mock apps data (could be fetched from API)
const appsList = [
  {
  name: "Shopify",
  description: "E-commerce platform for online stores and retail point-of-sale systems",
  logo: Shopify
},
{
  name: "Wix",
  description: "Website builder with drag-and-drop tools and business solutions",
  logo: Wix
},
{
  name: "Google",
  description: "Search engine, cloud computing, and productivity tools",
  logo: Google
},
{
  name: "Sheets",
  description: "Spreadsheet software for data organization and analysis (Google Sheets)",
  logo: Sheets
}
]

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

interface App {
  name: string
  description: string
  logo: string
}

const Page = () => {
  const { data: session, status } = useSession()

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [step, setStep] = useState<"select" | "form">("select")
  const [selectedApp, setSelectedApp] = useState<App | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [visibleValues, setVisibleValues] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)

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
    name: "",
    value: "",
    description: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleAppSelect = (app: App) => {
    setSelectedApp(app)
    setFormData((prev) => ({
      ...prev,
      app: app.name,
    }))
    setStep("form")
  }

  const resetForm = () => {
    setFormData({
      app: "",
      name: "",
      value: "",
      description: "",
    })
  }


  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!formData.app || !formData.name || !formData.value) {
    toast("Please fill in all required fields")
    return
  }

  setIsSubmitting(true)

  try {
    await axios.put(
      `http://localhost:8080/api/v1/secrets/${formData.app}/${formData.name}`,
      {
        value: formData.value,
        description: formData.description,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.user?.token}`,
        },
      }
    )

    // success — Axios only gets here for 2xx statuses
    const newCredential: Credential = {
      id: Date.now(),
      app: formData.app,
      name: formData.name,
      value: formData.value,
      description: formData.description,
      createdAt: new Date().toISOString().split("T")[0],
    }

    setCredentials((prev) => [...prev, newCredential])
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

  const toggleValueVisibility = (id: number) => {
    setVisibleValues((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
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

  const maskValue = (value: string | undefined | null): string => {
  if (!value) return "" // Handle undefined/null cases
  if (value.length <= 8) return "*".repeat(value.length)
  return `${value.substring(0, 4)}${"*".repeat(value.length - 8)}${value.substring(value.length - 4)}`
}

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-text font-generalSans">
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

      {/* STEP 1: Select App */}
      {step === "select" && (
        <DialogContent className="sm:max-w-[500px] bg-primary font-generalSans ">
          <DialogHeader>
            <DialogTitle className="text-text text-2xl">Apps Available</DialogTitle>
            <DialogDescription className="text-dHighlight">
              Select the app you would like to authenticate with.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {appsList.map((app) => (
  <div
    key={app.name}
    className="border  p-3 rounded-lg flex justify-between items-center bg-border cursor-pointer hover:bg-gradient-to-br from-bg-border to-dHighlight mr-2"
    onClick={() => handleAppSelect(app)}
  >
    {/* Left section: Logo + Name/Description */}
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12  overflow-hidden">
        <Image
          src={app.logo}
          alt={app.name}
          fill
          className="object-contain"
        />
      </div>
      <div>
        <h4 className="font-semibold text-primary">{app.name}</h4>
        <p className="text-xs text-bg-light">{app.description}</p>
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

      {/* STEP 2: Credential Form */}
      {step === "form" && (
        <DialogContent className="sm:max-w-[425px] bg-primary font-generalSans">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-text">Add New Credential for {selectedApp?.name}</DialogTitle>
              <DialogDescription className="text-text-muted">
                Add a new API credential to your secure vault.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-text">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., api_key, secret_key"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                  className="caret-text text-text"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="value" className="text-text">Value *</Label>
                <Input
                  id="value"
                  type="password"
                  placeholder="Enter the credential value"
                  value={formData.value}
                  onChange={(e) => handleInputChange("value", e.target.value)}
                  required
                  className="caret-text text-text"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-text">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this credential"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  rows={3}
                  className="caret-text text-text"
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
                  <TableHead className="font-semibold">App</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  {/* <TableHead className="font-semibold">Value</TableHead> */}
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="w-[100px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((credential) => (
                  <TableRow key={`${credential.app}-${credential.name}`}>
                    <TableCell className="font-medium">{credential.app}</TableCell>
                    <TableCell>{credential.name}</TableCell>
                    {/* <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {visibleValues.has(credential.id) ? credential.value : maskValue(credential.value)}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => toggleValueVisibility(credential.id)}>
                          {visibleValues.has(credential.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell> */}
                    <TableCell className="text-sm text-muted-foreground">{credential.description}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem> */}
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* API List Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Globe className="h-7 w-7" />
              API List
            </CardTitle>
            <CardDescription>Overview of all connected API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {apiList.map((api) => (
                <div
                  key={api.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{api.name}</h3>
                      <Badge variant={api.status === "Active" ? "default" : "secondary"}>{api.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{api.endpoint}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{api.method}</span>
                      <span>•</span>
                      <span>{api.version}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        •••
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>Test Connection</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        
      </div>
    </div>
  )
}

export default Page

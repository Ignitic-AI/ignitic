"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Upload, FileText, Trash2, Download, Eye, Plus, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import axios from "axios"
import { useSession } from "next-auth/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Asset {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  category: string
  status: "processing" | "ready" | "error"
}

const mockAssets: Asset[] = [
  {
    id: "1",
    name: "Company_Contract_2024.pdf",
    type: "application/pdf",
    size: 2048576,
    uploadedAt: "2024-01-15T10:30:00Z",
    category: "contracts",
    status: "ready",
  },
  {
    id: "2",
    name: "Financial_Report_Q1.pdf",
    type: "application/pdf",
    size: 1536000,
    uploadedAt: "2024-01-14T14:20:00Z",
    category: "reports",
    status: "ready",
  },
  {
    id: "3",
    name: "Employee_Handbook.pdf",
    type: "application/pdf",
    size: 3072000,
    uploadedAt: "2024-01-13T09:15:00Z",
    category: "hr",
    status: "processing",
  },
]

const categories = [
  { value: "contracts", label: "Contracts" },
  { value: "reports", label: "Reports" },
  { value: "hr", label: "HR Documents" },
  { value: "legal", label: "Legal" },
  { value: "financial", label: "Financial" },
  { value: "other", label: "Other" },
]

const statusColors = {
  processing: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
}

interface Category {
  id: number;
  name: string;
  description?: string;

  //Not to be added
  value?: string;
  label?: string;
}

export default function AssetsPage({orgId}: {orgId: string}) {
  const { data: session } = useSession();
  const [assets, setAssets] = useState<Asset[]>(mockAssets)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadCategory, setUploadCategory] = useState("")
  const [categories, setCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);


  async function uploadAsset(files: FileList | null, category: string) {
  if (!files || files.length === 0) return;

  const formData = new FormData();
  formData.append("user_id", `${session?.user?.user.id}`); 
  formData.append("category", category);

  // append all files
  for (let i = 0; i < files.length; i++) {
    formData.append("file", files[i]); 
  }

  // optional fields
  formData.append("organization_id",`${orgId}`); 
  formData.append("metadata", JSON.stringify({ uploadedFrom: "dialog" })); 

  try {
    const res = await axios.post("http://localhost:8080/api/v1/assets", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${session?.user?.token}`
      },
    });

    console.log("Upload success:", res.data);
    return res.data;
  } catch (err) {
    console.error("Upload failed:", err);
  }
}

  const handleButtonClick = () => {
    fileInputRef.current?.click(); // trigger file input click
  };



  useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await axios.get(
        "http://localhost:8080/api/v1/assets/categories",
        {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      );
      setCategories(response.data);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  if (session?.user?.token) {
    fetchData();
  }
}, [session?.user?.token]);



  console.log("Categories:", categories);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, [])

  // when user selects files
const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;

  setUploading(true);
  await uploadAsset(e.target.files, uploadCategory); 
  setUploading(false);

  // reset input so same file can be re-uploaded
  e.target.value = "";
};

  const handleFiles = async (files: FileList) => {
    setUploading(true)

    try {
      const fileArray = Array.from(files)

      for (const file of fileArray) {
        // Simulate file upload
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const newAsset: Asset = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          category: uploadCategory || "other",
          status: "processing",
        }

        setAssets((prev) => [newAsset, ...prev])

        // Simulate processing completion
        setTimeout(() => {
          setAssets((prev) =>
            prev.map((asset) => (asset.id === newAsset.id ? { ...asset, status: "ready" as const } : asset)),
          )
        }, 2000)
      }

      toast( `${fileArray.length} file(s) uploaded successfully`,
      )
    } catch (error) {
      toast( "Failed to upload files",

      )
    } finally {
      setUploading(false)
      setIsUploadDialogOpen(false)
      setUploadCategory("")
    }
  }

  const handleDelete = (assetId: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== assetId))
    toast(
 "Asset deleted successfully")
  }

  const handleDownload = (asset: Asset) => {
    // Simulate download
    toast(
      `Downloading ${asset.name}`,
    )
  }

  const handlePreview = (asset: Asset) => {
    // Simulate preview
    toast(
       `Opening preview for ${asset.name}`,
)
  }

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || asset.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen w-full bg-gray-900 text-text font-generalSans p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Assets</h1>
            <p className="text-gray-400 mt-1">Manage your organization's documents and files</p>
          </div>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-bg hover:bg-highlight text-text font-semibold ">
                <Plus className="h-4 w-4 mr-1" />
                Upload Assets
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-bg border-gray-700 text-text font-generalSans w-3/4 h-3/4">
              <DialogHeader>
                <DialogTitle className="text-white">Upload New Assets</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Select a category and upload your documents
                </DialogDescription>
                {/* Add spacing wrapper */}
  <div className="mt-2 space-y-2">
    <Label htmlFor="category" className="text-text">
      Category
    </Label>
    <Select value={uploadCategory} onValueChange={setUploadCategory}>
      <SelectTrigger className="bg-gray-700 border-gray-600 text-text">
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent className="bg-info border-gray-600 font-generalSans">
        {categories.map((category) => (
          <TooltipProvider key={category.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectItem value={category.name} className="text-text">
                  {category.name}
                </SelectItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>{category.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </SelectContent>
    </Select>
  </div>
              </DialogHeader>
              
                
                  
                

                {/* Dotted Upload Area */}
                <div
                  className={`relative rounded-lg text-center transition-colors bg-bg -mt-30 flex justify-center items-center min-h-[200px]`}
                  style={{
                    backgroundImage: `radial-gradient(circle, ${
                      dragActive ? "#a855f7" : "#6b7280"
                    } 1.5px, transparent 1px)`,
                    backgroundSize: "20px 20px", // smaller = denser dots
    backgroundRepeat: "repeat",  // ensure pattern covers entire area
    backgroundPosition: "0 0", 
                  }}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />

                    

                    {/* <div>
                      <p className="text-lg font-medium text-white">
                        {uploading ? "Uploading..." : "Drop files here or click to browse"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Supports PDF, DOC, DOCX, TXT, JPG, PNG files up to 10MB
                      </p>
                    </div> */}

                    {!uploading && (
                      <Button
                        type="button"
                        onClick={handleButtonClick}
                        variant="outline"
                        className="relative z-10 px-6 py-3 font-semibold text-gray-800 rounded-lg 
             bg-gradient-to-b from-gray-200 via-gray-300 to-gray-400
             border border-gray-500 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),inset_-1px_-1px_2px_rgba(0,0,0,0.15)]
             hover:from-gray-300 hover:via-gray-400 hover:to-gray-500
             hover:shadow-[inset_2px_2px_4px_rgba(255,255,255,0.8),inset_-2px_-2px_4px_rgba(0,0,0,0.2)]
             transition-all duration-300 flex justify-center items-center"
                      >
                        Choose Files
                      </Button>
                    )}
                  
                </div>
              
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white">
                  All Categories
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name} className="text-white">
                    {category.name}

                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Assets Grid */}
        <div className="grid gap-4">
          {filteredAssets.length === 0 ? (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No assets found</h3>
                <p className="text-gray-400 mb-4">
                  {searchTerm || selectedCategory !== "all"
                    ? "Try adjusting your search or filters"
                    : "Upload your first document to get started"}
                </p>
                <Button
                  onClick={() => setIsUploadDialogOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Assets
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredAssets.map((asset) => (
              <Card key={asset.id} className="bg-bg border-gray-700 hover:bg-gray-750 transition-colors">
                <CardContent className="">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{asset.name}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span>{formatFileSize(asset.size)}</span>
                          <span>•</span>
                          <span>{formatDate(asset.uploadedAt)}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs text-text">
                            {categories.find((c) => c.value === asset.category)?.label || asset.category}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`${statusColors[asset.status]} border-0`}>
                        {asset.status}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                          <DropdownMenuItem
                            onClick={() => handlePreview(asset)}
                            className="text-white hover:bg-gray-700"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownload(asset)}
                            className="text-white hover:bg-gray-700"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(asset.id)}
                            className="text-red-400 hover:bg-gray-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

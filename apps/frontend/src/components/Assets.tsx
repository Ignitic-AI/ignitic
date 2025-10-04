"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { Upload, Folder, Check, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import axios from "axios"
import { useSession } from "next-auth/react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion } from "framer-motion"
import { z } from "zod"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrgStore } from "@/app/_store/useorgStore"
import { LoadingLogo } from "@/components/Loading"


interface Asset {
  id: string
  organization_id: string
  userId: string
  category: string
  title: string
  storage_provider: string
  path: string
  url: string
  mime_type: string
  file_ext: string
  size_bytes: number
  created_by: string
  created_at: string
  updated_at: string
  status?: "processing" | "ready" | "error" 
}

interface Organization {
  id?: string;
  name: string;
  description: string;
  memberCount: number;
  role: string;
  createdAt: string;
  subscription_plan: string;
  ecommerce_domain: string;
  industry: string;
  company_size: string;
  website: string;
  country: string;
  city: string;
  status?: string;
  address?: string;
  phone_number?: string;
}

interface Category {
  id: string
  name: string
  description?: string
  // Not to be added
  value?: string
  label?: string
}

interface LogMessage {
  type: "success" | "error";
  message: string;
  data?: Asset | any;
}


export default function AssetsPage() {
  const { data: session } = useSession()
  console.log("Session: ",session?.user.user)
  const [assets, setAssets] = useState<Asset[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAssets, setShowAssets] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [loading,setLoading] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { currentOrg } = useOrgStore();
  const [orgNames, setOrgNames] = useState<{ [key: string]: string }>({});


  const uploadSchema = z.object({
  category: z.string().min(1, "Category is required"),
});

const handleDelete = async (id: string) => {
  try {
    await axios.delete(`http://localhost:8080/api/v1/assets/${id}`, {
      headers: {
        Authorization: `Bearer ${session?.user?.token}`, // 🔑 If your API requires auth
      },
    });

    // remove from state after successful deletion
    setAssets((prevAssets) => prevAssets.filter((asset) => asset.id !== id));
    toast("Assets Deleted Successfully"); 
  } catch (error: any) {
    toast("Error deleting Asset");
  }
};

  async function uploadAsset(files: FileList | null, category: string) {
    if (!files || files.length === 0) return

    // Validate category using Zod
  try {
  uploadSchema.parse({ category })
  setErrorMessage(null) 
} catch (error) {
  if (error instanceof z.ZodError) {
    toast("Select a Category to Upload")
    return
  }
}


    const file = files[0]

    const formData = new FormData()
    

    formData.append("category", category) 
    
    if (currentOrg?.id) {
      formData.append("organization_id", currentOrg.id)
    }
    
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""))
    formData.append("file", file)


    try {
      const res = await axios.post("http://localhost:8080/api/v1/assets", formData, {
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
        },
      })

      
      setLogs((prev) => [
        ...prev,
        {
          type: "success",
          message: `Uploaded: ${res.data.title}`,
          data: res.data,
        },
      ]);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          type: "error",
          message: err.response?.data?.message || "Upload failed",
          data: err.response?.data || err.message,
        },
      ]);
    }
  }
  console.log("Assets: ",assets)
  const handleButtonClick = () => {
    fileInputRef.current?.click() 
  }

   // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId) // remove if already selected
        : [...prev, categoryId] // add if not selected
    );
  };  

 

  const formatFileSize = (sizeInBytes:number) => {
    if (!sizeInBytes || isNaN(sizeInBytes)) return "0 KB";
    const sizeInMB = sizeInBytes / (1024 * 1024);
    if (sizeInMB < 1) {
      return `${(sizeInMB * 1024).toFixed(0)} KB`;
    }
    return `${sizeInMB.toFixed(1)} MB`;
  };

  useEffect(() => {
    setLoading(true)
  const fetchAssets = async () => {
    try {
      const response = await axios.get(
        "http://localhost:8080/api/v1/assets",
        {
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      )
      setAssets(response.data) 
    } catch (err) {
      console.error("Error fetching assets:", err)
    }
    setLoading(false)
  }

  if (session?.user?.token) {
    fetchAssets()
  }
}, [session?.user?.token])

 // Filter assets based on selected categories
  const filteredAssets =
    selectedCategories.length === 0
      ? assets
      : assets.filter((asset) => selectedCategories.includes(asset.category));
  
  const personalAssets = filteredAssets.filter((asset) => !asset.organization_id);
const organizationAssets = filteredAssets.filter((asset) => asset.organization_id);


const organizationIds = useMemo(() => {
  const ids = filteredAssets
    .filter(a => a.organization_id)
    .map(a => a.organization_id);
  return [...new Set(ids)];
}, [filteredAssets]);

console.log("Organization IDs: ",organizationIds)

  useEffect(() => {
  async function fetchOrgNames() {
    const names:{ [key: string]: string } = {};
    await Promise.all(organizationIds.map(async (id) => {
      try {
        const { data } = await axios.get(`http://localhost:8080/api/v1/organizations/${id}`,
          {
            headers: {
              Authorization: `Bearer ${session?.user?.token}`,
            },
          }
        );
        names[id] = data.organization.name;
      } catch {
        names[id] = 'Unknown Organization';
      }
    }));
    setOrgNames(names);
  }
  if (organizationIds.length) fetchOrgNames();
}, [organizationIds]);
console.log("Org Names: ",orgNames)

  const assetsByOrgName: { [key: string]: Asset[] } = {};

organizationAssets.forEach(asset => {
  const name = orgNames[asset.organization_id] || "Unknown Organization";
  if (!assetsByOrgName[name]) assetsByOrgName[name] = [];
  assetsByOrgName[name].push(asset);
});

  useEffect(() => {
    setLoading(true)
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
        )
        setCategories(response.data)
      } catch (err) {
        console.error("Error fetching categories:", err)
      }
      setLoading(false)
    }

    if (session?.user?.token) {
      fetchData()
    }
  }, [session?.user?.token])



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

  }, [])

  // when user selects files
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    setUploading(true)
    await uploadAsset(e.target.files, uploadCategory)
    setUploading(false)

    e.target.value = ""
  }



  return (
    <>
      {showAssets ? (
        loading ? (
          <LoadingLogo/>
  //         <div className="h-screen w-full dark:bg-bg-dark  bg-bg-dark-lm  p-6 font-generalSans overflow-auto">
  //   <div className="max-w-6xl mx-auto space-y-8">
  //     {/* Header Skeleton */}
  //     <div className="flex items-center justify-between">
  //       <Skeleton className="h-8 w-40 rounded-md" />
  //       <Skeleton className="h-10 w-32 rounded-md" />
  //     </div>

  //     {/* Files Skeleton */}
  //     <div>
  //       <Skeleton className="h-6 w-24 mb-3 rounded-md" />
  //       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  //         {Array.from({ length: 4 }).map((_, i) => (
  //           <div
  //             key={i}
  //             className="bg-gray-800 border-info border-2 rounded-lg p-4 space-y-4"
  //           >
  //             {/* Icon + count */}
  //             <div className="flex items-center gap-2">
  //               <Skeleton className="h-8 w-8 rounded-md" />
  //               <Skeleton className="h-4 w-16 rounded-md" />
  //             </div>

  //             {/* Category name */}
  //             <Skeleton className="h-5 w-24 rounded-md" />

  //             {/* Description */}
  //             <Skeleton className="h-3 w-40 rounded-md" />
  //             <Skeleton className="h-3 w-32 rounded-md" />
  //           </div>
  //         ))}
  //       </div>
  //     </div>
  //   </div>
  // </div>
        ): (
        <div className="h-screen w-full dark:bg-bg-dark  bg-bg-dark-lm p-6 font-generalSans overflow-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold dark:text-text text-text-lm">Assets</h1>
              <button
                onClick={() => {setShowAssets(!showAssets);
                  console.log("ShowAssets is being clicked")
                }}
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-lm text-white dark:hover:bg-info dark:bg-primary dark:text-white hover:bg-info-lm transition"
              >
                <Upload className="h-4 w-4" /> Upload Asset
              </button>
            </div>
            
      {/* Category Selectors */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.slice(0, 6).map((category) => (
          <button
            key={category.id}
            className={`px-4 py-2 rounded-full transition-all ${
              selectedCategories.includes(category.id)
                ? "bg-green-400 dark:bg-success text-text-lm dark:text-text border-primary"
                : "bg-highlight-lm text-text-lm hover:bg-info-lm dar:bg-highlight dark:text-bg dark:hover:bg-info "
            }`}
            onClick={() => toggleCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Asset List */}
      {personalAssets.length > 0 && (
      <>
        <h3 className="text-lg font-semibold mb-2">Personal Assets</h3>
        <ul className="space-y-3">
          {personalAssets.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between border-b border-text pb-2"
            >
              <div className="flex items-center justify-between gap-2">
                <Folder className="w-5 h-5 text-info" />
                <span className="text-primary">{asset.title}</span>
                <span className="text-sm text-gray-400 ml-2">
                  ({formatFileSize(asset.size_bytes)})
                </span>
                <Badge variant="secondary" className="text-xs bg-yellow-100">
                  {asset.file_ext.toUpperCase()}
                </Badge>
              </div>
              <span className="text-sm text-gray-400 ml-auto mr-2">
                Uploaded{" "}
                {new Date(asset.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>

              {/* Delete Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="text-danger hover:text-red-500 mr-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-sm">
                    <p>Delete Asset</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </li>
          ))}
        </ul>
      </>
    )}

    {Object.entries(assetsByOrgName).map(([orgName, assets]) => (
  <div key={orgName} className="mb-6">
    <h3 className="text-lg font-semibold mt-6 mb-2"> <span className="text-info"> Organization:</span>  {orgName}</h3>
    <ul className="space-y-3">
      {assets.map((asset) => (
        <li
          key={asset.id}
          className="flex items-center justify-between border-b border-text pb-2"
        >
          <div className="flex items-center justify-between gap-2">
            <Folder className="w-5 h-5 text-info" />
            <span className="text-primary">{asset.title}</span>
            <span className="text-sm text-gray-400 ml-2">
              ({formatFileSize(asset.size_bytes)})
            </span>
            <Badge variant="secondary" className="text-xs bg-yellow-100">
              {asset.file_ext.toUpperCase()}
            </Badge>
          </div>
          <span className="text-sm text-gray-400 ml-auto mr-2">
            Uploaded{" "}
            {new Date(asset.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          {/* Delete Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="text-danger hover:text-red-500 mr-2"
                >
                  <Trash2 size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-sm">
                <p>Delete Asset</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </li>
      ))}
    </ul>
  </div>
))}

    {filteredAssets.length === 0 && (
      <div className="flex items-center justify-center h-64">
      <p className="text-text-muted-lm dark:text-text-muted ">
        No assets found in selected categories
      </p>
      </div>
    )}

      
            
          </div>
        </div>
      )
        
      ) : (
        <div className="h-screen w-full bg-white text-primary font-generalSans p-6 overflow-auto">
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back Navigation */}
      <button onClick={() => setShowAssets(!showAssets)} className="text-md text-blue-400 hover:underline">&lt; Back to Files</button>

      {/* Title + Category */}
<div className="flex items-center justify-between mb-4">
  {/* Left side - Title */}
  <h1 className="text-2xl font-bold text-primary">Upload Asset Files</h1>

  {/* Right side - Category */}
  <div className="flex items-center gap-2">
    <Label htmlFor="category" className="text-primary font-semibold text-lg">
      Category:
    </Label>
    <Select value={uploadCategory} onValueChange={setUploadCategory}>
      <SelectTrigger className="bg-gray-700 border-gray-600 text-primary w-[200px]">
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent className="bg-info border-gray-600 font-generalSans">
        {categories.map((category) => (
          <TooltipProvider key={category.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectItem value={category.id} className="text-primary">
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
</div>



      {/* Upload Box */}
      <div
        className={`relative rounded-xl text-center transition-colors bg-bg border border-gray-600 flex flex-col justify-center items-center min-h-[200px]`}
        style={{
          backgroundImage: `radial-gradient(circle, ${
            dragActive ? "#a855f7" : "#6b7280"
          } 1.5px, transparent 1px)`,
          backgroundSize: "20px 20px",
          backgroundRepeat: "repeat",
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
          accept=".pdf,.jpg,.jpeg,.png,.fig,.svg"
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        <Button type="button" onClick={handleButtonClick} variant="outline" className="relative z-10 px-6 py-3 font-semibold text-gray-800 rounded-lg bg-gradient-to-b from-gray-200 via-gray-300 to-gray-400 border border-gray-500 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),inset_-1px_-1px_2px_rgba(0,0,0,0.15)] hover:from-gray-300 hover:via-gray-400 hover:to-gray-500 hover:shadow-[inset_2px_2px_4px_rgba(255,255,255,0.8),inset_-2px_-2px_4px_rgba(0,0,0,0.2)] transition-all duration-300 flex justify-center items-center">
          Click here
        </Button>
        
      </div>
      
          <motion.ul
      // className="mt-4 space-y-3 p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {logs.map((log, idx) => (
        <motion.li
          key={idx}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.1 }}
          className={`p-3 mb-2 rounded-2xl shadow-md border-sucess border-2 flex items-center justify-between ${
            log.type === "success"
              ? "bg-gradient-to-b from-gray-200 via-gray-300 to-gray-400 border border-gray-500 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),inset_-1px_-1px_2px_rgba(0,0,0,0.15)] shadow-green-100"
              : "bg-gradient-to-b from-gray-200 via-gray-300 to-gray-400 border border-gray-500 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),inset_-1px_-1px_2px_rgba(0,0,0,0.15)]  shadow-red-100"
          }`}
        >
          <div className="flex items-center gap-3">
            {/* <div className={`p-1 rounded-full ${log.type === "success" ? "bg-green-100" : "bg-red-100"}`}>
              {log.type === "success" ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <X className="w-4 h-4 text-red-600" />
              )}
            </div> */}
            <div>
            
              <span className="text-primary ml-2 text-md">{log.message}</span>
            </div>
          </div>
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              log.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {log.type === "success" ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
          </div>
        </motion.li>
      ))}
    </motion.ul>
      
      

      
    </div>
  </div>
      )}
    </>
  )
}
"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Asset {
  id: string
  organizationId: string
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
  status?: "processing" | "ready" | "error" // optional, if you plan to track it on frontend
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


export default function AssetsPage({ orgId }: { orgId: string }) {
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  


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
    
    if (orgId) {
      formData.append("organization_id", orgId)
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

  const handleCardClick = (categoryId:string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const getCategoryStats = (categoryId:string) => {
    const categoryAssets = assets.filter(asset => asset.category === categoryId);
    const fileCount = categoryAssets.length;
    const totalSize = categoryAssets.reduce((sum, asset) => sum + asset.size_bytes, 0);
    return { fileCount, totalSize };
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
  }

  if (session?.user?.token) {
    fetchAssets()
  }
}, [session?.user?.token])



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
        )
        setCategories(response.data)
      } catch (err) {
        console.error("Error fetching categories:", err)
      }
    }

    if (session?.user?.token) {
      fetchData()
    }
  }, [session?.user?.token])

  // console.log("Categories:", categories)


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

    // reset input so same file can be re-uploaded
    e.target.value = ""
  }



  return (
    <>
      {showAssets ? (
        <div className="h-screen w-full bg-gray-900 text-text p-6 font-generalSans overflow-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Materials</h1>
              <button
                onClick={() => {setShowAssets(!showAssets);
                  console.log("ShowAssets is being clicked")
                }}
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                <Upload className="h-4 w-4" /> Upload Asset
              </button>
            </div>

            {/* Files */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Assets</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map((category) => {
        const categoryAssets = assets.filter(
          (asset) => asset.category === category.id
        );
        const { fileCount, totalSize } = getCategoryStats(category.id);
        const isExpanded = expandedCategory === category.id;

        return (
          <Card 
            key={category.id} 
            className={`bg-gray-800 text-text border-info border-2 cursor-pointer hover:bg-gray-750 transition-all hover:shadow-2xl ${
              isExpanded ? 'md:col-span-2 lg:col-span-3 xl:col-span-4' : ''
            }`}
            onClick={() => handleCardClick(category.id)}
          >
            <CardHeader className="">
              <div className="flex flex-col  gap-2">
                <div className="flex items-center gap-2 mb-2">
                  <Folder className="w-8 h-8 text-info " />
                  <p className="text-sm text-text-muted ">{fileCount} files</p>
                </div>
  
  
</div>
              
            </CardHeader>
            <CardContent className="text-lg font-bold text-left -mb-2">
    {category.name}
  </CardContent>
            
            {isExpanded && (
              <CardContent>
                <div className="mb-2">
                  <p className="text-sm text-gray-400 mb-4 -mt-4">{category.description}</p>
                  <p className="text-sm text-gray-300">
                    {fileCount} files • {formatFileSize(totalSize)}
                  </p>
                </div>
                
                {categoryAssets.length > 0 ? (
                  <ul className="space-y-2">
                    {categoryAssets.map((asset) => (
                      <li key={asset.id} className="flex items-center justify-between  pb-2 border-b border-text">
                        <div>
                          <span className="text-text">{asset.title}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            ({formatFileSize(asset.size_bytes)})
                          </span>
                        </div>
                        {/* Delete Button */}
  <TooltipProvider>
  <Tooltip  >
    <TooltipTrigger asChild>
      <button
        onClick={(e) => {e.stopPropagation(); handleDelete(asset.id)}}
        className="text-danger hover:text-red-500 mr-4"
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
                ) : (
                  <p className="text-gray-500 italic">No assets in this category</p>
                )}
                
                <p className="flex items-center justify-center text-xs text- mt-4">
  <motion.span
    animate={{
      y: [0, -4, 0], // Bounce up and down
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    }}
    className="flex items-center"
  >
    Click again to collapse
  </motion.span>
</p>
              </CardContent>
            )}
          </Card>
        );
      })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-screen w-full bg-gray-900 text-text font-generalSans p-6 overflow-auto">
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back Navigation */}
      <button onClick={() => setShowAssets(!showAssets)} className="text-md text-blue-400 hover:underline">&lt; Back to Files</button>

      {/* Title + Category */}
<div className="flex items-center justify-between mb-4">
  {/* Left side - Title */}
  <h1 className="text-2xl font-bold text-text">Upload Asset Files</h1>

  {/* Right side - Category */}
  <div className="flex items-center gap-2">
    <Label htmlFor="category" className="text-text font-semibold text-lg">
      Category:
    </Label>
    <Select value={uploadCategory} onValueChange={setUploadCategory}>
      <SelectTrigger className="bg-gray-700 border-gray-600 text-text w-[200px]">
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent className="bg-info border-gray-600 font-generalSans">
        {categories.map((category) => (
          <TooltipProvider key={category.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectItem value={category.id} className="text-text">
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
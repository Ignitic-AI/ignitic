"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { Upload, Folder, Check, X, Trash2, ArrowLeft, FileUp, CloudUpload } from "lucide-react"
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
import { useOrgStore } from "@/app/_store/useorgStore"
import { LoadingLogo } from "@/components/Loading"
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";


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
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  const openPreview = (asset: Asset) => setPreviewAsset(asset);
  const closePreview = () => setPreviewAsset(null);


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
  const fetchAssets = async () => {
    setLoading(true)
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
  } else {
    setLoading(false)
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
    
    const fetchData = async () => {
      setLoading(true)
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
    } else{
      setLoading(false)
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
              <div>
                <h1 className="text-3xl font-bold dark:text-text text-text-lm">Assets</h1>
              <p className="dark:text-text-muted text-text-muted-lm  ">Manage your assets</p>
              </div>
              
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
          <>
      <ul className="space-y-3">
        {personalAssets.map((asset) => (
          <li
            key={asset.id}
            className="flex items-center justify-between border-b border-text pb-2 cursor-pointer"
            onClick={() => openPreview(asset)}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-info" />
              <span className="dark:text-primary text-primary-lm">{asset.title}</span>
              <span className="text-sm text-text-muted-lm dark:text-text-muted ml-2">
                ({formatFileSize(asset.size_bytes)})
              </span>
              <Badge variant="secondary" className="text-xs bg-red-400">
                {asset.file_ext.toUpperCase()}
              </Badge>
            </div>

            <span className="text-sm text-text-muted-lm dark:text-text-muted ml-auto mr-2">
              Uploaded{" "}
              {new Date(asset.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(asset.id);
                    }}
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

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <button
              onClick={closePreview}
              className="absolute top-4 right-4 z-10 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-2 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-4">
              <DocViewer
                documents={[{ uri: previewAsset.url }]}
                pluginRenderers={DocViewerRenderers}
                config={{
                  header: {
                    disableHeader: false,
                    disableFileName: false,
                    retainURLParams: false,
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
      </>
    )}

    {Object.entries(assetsByOrgName).map(([orgName, assets]) => (
  <div key={orgName} className="mb-6">
    <h3 className="text-lg font-semibold mt-6 mb-2"> <span className="text-info"> Organization:</span>  {orgName}</h3>
     <>
      <ul className="space-y-3">
        {assets.map((asset) => (
          <li
            key={asset.id}
            className="flex items-center justify-between border-b border-text pb-2 cursor-pointer"
            onClick={() => openPreview(asset)}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-info" />
              <span className="dark:text-primary text-primary-lm">{asset.title}</span>
              <span className="text-sm text-text-muted-lm dark:text-text-muted ml-2">
                ({(asset.size_bytes / 1024).toFixed(2)} KB)
              </span>
              <span className="text-xs bg-blue-400 px-1 rounded text-white">
                {asset.file_ext.toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-text-muted-lm dark:text-text-muted ml-auto mr-2">
              {new Date(asset.created_at).toLocaleDateString()}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation(); 
                handleDelete(asset.id);
              }}
              className="text-danger hover:text-red-500"
            >
              <Trash2 size={18} />
            </button>
          </li>
        ))}
      </ul>

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded max-w-3xl w-full relative">
            <button
              onClick={closePreview}
              className="absolute top-2 right-2 text-gray-500"
            >
              Close
            </button>

            {previewAsset.mime_type.startsWith("image/") ? (
              <img
                src={previewAsset.url}
                alt={previewAsset.title}
                className="max-h-[80vh] mx-auto"
              />
            ) : previewAsset.mime_type === "application/pdf" ? (
              <iframe
                src={previewAsset.url}
                className="w-full h-[80vh]"
                title={previewAsset.title}
              />
            ) : previewAsset.mime_type.match(
                /(msword|vnd.openxmlformats-officedocument.wordprocessingml.document|vnd.ms-powerpoint|vnd.openxmlformats-officedocument.presentationml.presentation)/
              ) ? (
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                  previewAsset.url
                )}`}
                className="w-full h-[80vh]"
                title={previewAsset.title}
              />
            ) : (
              <p className="text-center mt-20">
                Preview not available for this file type.
              </p>
            )}
          </div>
        </div>
      )}
    </>
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
        <div className="h-screen w-full dark:bg-bg-dark bg-bg-dark-lm font-generalSans p-6 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Back Navigation */}
            <Button
              onClick={() => setShowAssets(!showAssets)}
              variant="ghost"
              className="flex items-center gap-2 text-info-lm dark:text-info hover:bg-highlight-lm dark:hover:bg-highlight rounded-lg px-3 py-2 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Files</span>
            </Button>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border-lm dark:border-border">
              <div>
                <h1 className="text-3xl font-bold dark:text-text text-text-lm flex items-center gap-3">
                  <CloudUpload className="w-8 h-8 text-info-lm dark:text-info" />
                  Upload Asset Files
                </h1>
                <p className="text-text-muted-lm dark:text-text-muted mt-1">
                  Upload your documents, images, and other files
                </p>
              </div>

              {/* Category Selector */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="category" className="dark:text-text text-text-lm font-semibold text-sm">
                  Select Category
                </Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="bg-white dark:bg-bg-dark border-2 border-info-lm dark:border-info text-text-lm dark:text-text w-[280px] h-11 rounded-lg font-medium">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-bg-dark border-2 border-info-lm dark:border-info font-generalSans">
                    {categories.map((category) => (
                      <TooltipProvider key={category.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SelectItem 
                              value={category.id} 
                              className="text-text-lm dark:text-text cursor-pointer hover:bg-highlight-lm dark:hover:bg-highlight"
                            >
                              {category.name}
                            </SelectItem>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="bg-bg-dark text-text border-info">
                            <p>{category.description || category.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>



            {/* Upload Area */}
            <div
              className={`relative rounded-2xl border-3 transition-all duration-300 ${
                dragActive
                  ? "border-info-lm dark:border-info bg-info-lm/10 dark:bg-info/10 scale-[1.02]"
                  : "border-dashed border-2 border-border-lm dark:border-border bg-white dark:bg-bg hover:border-info-lm dark:hover:border-info"
              } min-h-[400px] flex flex-col items-center justify-center p-8`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                multiple
                ref={fileInputRef}
                accept=".pdf,.jpg,.jpeg,.png,.fig,.svg,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />

              {/* Upload Icon */}
              <div className={`mb-6 transition-transform duration-300 ${dragActive ? "scale-110" : ""}`}>
                <div className="relative">
                  <div className="absolute inset-0 bg-info-lm dark:bg-info rounded-full blur-xl opacity-30 animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-info-lm to-primary-lm dark:from-info dark:to-primary p-6 rounded-full">
                    <FileUp className="w-16 h-16 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              </div>

              {/* Text Content */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold dark:text-text text-text-lm mb-2">
                  {dragActive ? "Drop your files here" : "Choose files or drag & drop"}
                </h3>
                <p className="text-text-muted-lm dark:text-text-muted text-base">
                  Supported formats: PDF, JPG, PNG, SVG, DOC, DOCX, XLS, XLSX, PPT, PPTX
                </p>
                <p className="text-text-muted-lm dark:text-text-muted text-sm mt-1">
                  Maximum file size: 50MB
                </p>
              </div>

              {/* Upload Button */}
              <Button
                type="button"
                onClick={handleButtonClick}
                disabled={uploading}
                className="bg-gradient-to-r from-info-lm to-primary-lm dark:from-info dark:to-primary hover:from-primary-lm hover:to-info-lm dark:hover:from-primary dark:hover:to-info text-white font-semibold px-8 py-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5 mr-2" />
                {uploading ? "Uploading..." : "Select Files"}
              </Button>

              {!uploadCategory && (
                <p className="text-orange-500 dark:text-orange-400 text-sm mt-4 font-medium">
                  ⚠️ Please select a category before uploading
                </p>
              )}
            </div>
      
            {/* Upload Logs */}
            {logs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <h3 className="text-lg font-semibold dark:text-text text-text-lm flex items-center gap-2">
                  <FileUp className="w-5 h-5" />
                  Upload History
                </h3>
                <motion.ul className="space-y-2">
                  {logs.map((log, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.1 }}
                      className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                        log.type === "success"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-500"
                          : "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            log.type === "success" ? "bg-green-500" : "bg-red-500"
                          }`}
                        >
                          {log.type === "success" ? (
                            <Check className="w-5 h-5 text-white" strokeWidth={3} />
                          ) : (
                            <X className="w-5 h-5 text-white" strokeWidth={3} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium dark:text-text text-text-lm">{log.message}</p>
                          {log.data?.category && (
                            <p className="text-sm text-text-muted-lm dark:text-text-muted">
                              Category: {categories.find(c => c.id === log.data.category)?.name || log.data.category}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={log.type === "success" ? "default" : "destructive"}
                        className={`${
                          log.type === "success"
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-red-500 hover:bg-red-600"
                        } text-white`}
                      >
                        {log.type === "success" ? "Success" : "Failed"}
                      </Badge>
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
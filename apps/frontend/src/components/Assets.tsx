"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  Upload,
  Trash2,
  X,
  FileUp,
  CloudUpload,
  Search,
  LayoutGrid,
  List,
  MoreHorizontal,
  Eye,
  Shield,
  Check,
  FileText,
  FileSpreadsheet,
  Presentation,
  ImageIcon,
  Archive,
  File,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import axios from "axios"
import { useSession } from "next-auth/react"
import { z } from "zod"
import { useOrgStore } from "@/app/_store/useorgStore"
import { LoadingLogo } from "@/components/Loading"
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const API = "http://localhost:8080/api/v1"
const PRIMARY = "#0056D2"

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
  value?: string
  label?: string
}

function formatFileSize(sizeInBytes: number) {
  if (!sizeInBytes || isNaN(sizeInBytes)) return "0 KB"
  const sizeInMB = sizeInBytes / (1024 * 1024)
  if (sizeInMB < 1) return `${(sizeInMB * 1024).toFixed(0)} KB`
  return `${sizeInMB.toFixed(1)} MB`
}

function fileKind(ext: string): { Icon: typeof File; box: string; desc: string } {
  const e = ext.toLowerCase().replace(".", "")
  if (e === "pdf")
    return { Icon: FileText, box: "bg-red-600", desc: "PDF document" }
  if (e === "doc" || e === "docx")
    return { Icon: FileText, box: "bg-blue-700", desc: "Microsoft Word document" }
  if (e === "xls" || e === "xlsx" || e === "csv")
    return { Icon: FileSpreadsheet, box: "bg-emerald-600", desc: "Spreadsheet" }
  if (e === "ppt" || e === "pptx")
    return { Icon: Presentation, box: "bg-orange-600", desc: "Presentation" }
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(e))
    return { Icon: ImageIcon, box: "bg-violet-600", desc: "Image" }
  if (["zip", "rar", "7z"].includes(e))
    return { Icon: Archive, box: "bg-sky-600", desc: "Archive" }
  return { Icon: File, box: "bg-slate-600", desc: "File" }
}

const uploadSchema = z.object({
  category: z.string().min(1, "Category is required"),
})

export default function AssetsPage() {
  const { data: session } = useSession()
  const [assets, setAssets] = useState<Asset[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const { currentOrg } = useOrgStore()
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [search, setSearch] = useState("")
  const [fileTab, setFileTab] = useState<"all" | "recent" | "shared">("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")

  const fetchAssets = useCallback(async () => {
    if (!session?.user?.token) return
    setLoading(true)
    try {
      const response = await axios.get(`${API}/assets`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${session.user.token}`,
        },
      })
      setAssets(response.data)
    } catch (err) {
      console.error("Error fetching assets:", err)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.token])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  useEffect(() => {
    const run = async () => {
      if (!session?.user?.token) return
      try {
        const response = await axios.get(`${API}/assets/categories`, {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${session.user.token}`,
          },
        })
        setCategories(response.data)
      } catch (err) {
        console.error("Error fetching categories:", err)
      }
    }
    run()
  }, [session?.user?.token])

  const organizationIds = useMemo(() => {
    const ids = assets.filter((a) => a.organization_id).map((a) => a.organization_id)
    return [...new Set(ids)]
  }, [assets])

  useEffect(() => {
    async function fetchOrgNames() {
      const names: Record<string, string> = {}
      await Promise.all(
        organizationIds.map(async (id) => {
          try {
            const { data } = await axios.get(`${API}/organizations/${id}`, {
              headers: { Authorization: `Bearer ${session?.user?.token}` },
            })
            names[id] = data.organization.name
          } catch {
            names[id] = "Organization"
          }
        })
      )
      setOrgNames(names)
    }
    if (organizationIds.length) fetchOrgNames()
  }, [organizationIds, session?.user?.token])

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    )
  }

  const clearCategoryFilters = () => setSelectedCategories([])

  const byCategory =
    selectedCategories.length === 0
      ? assets
      : assets.filter((a) => selectedCategories.includes(a.category))

  const byTab = useMemo(() => {
    let list = [...byCategory]
    if (fileTab === "shared") list = list.filter((a) => !!a.organization_id)
    if (fileTab === "recent") {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return list
  }, [byCategory, fileTab])

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter((a) => a.title.toLowerCase().includes(q))
  }, [byTab, search])

  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.name || id

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API}/assets/${id}`, {
        headers: { Authorization: `Bearer ${session?.user?.token}` },
      })
      setAssets((prev) => prev.filter((a) => a.id !== id))
      toast.success("File removed")
    } catch {
      toast.error("Could not delete file")
    }
  }

  async function uploadSingleFile(file: File, category: string) {
    const formData = new FormData()
    formData.append("category", category)
    if (currentOrg?.id) formData.append("organization_id", currentOrg.id)
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""))
    formData.append("file", file)

    const res = await axios.post(`${API}/assets`, formData, {
      headers: { Authorization: `Bearer ${session?.user?.token}` },
    })
    return res.data
  }

  const completeUpload = async () => {
    try {
      uploadSchema.parse({ category: uploadCategory })
    } catch {
      toast.error("Choose a category")
      return
    }
    if (pendingFiles.length === 0) {
      toast.error("Add at least one file")
      return
    }
    setUploading(true)
    try {
      for (const file of pendingFiles) {
        await uploadSingleFile(file, uploadCategory)
      }
      toast.success(`Uploaded ${pendingFiles.length} file(s)`)
      setPendingFiles([])
      setUploadOpen(false)
      await fetchAssets()
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null
      toast.error(msg || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const files = e.dataTransfer.files
    if (files?.length) setPendingFiles((prev) => [...prev, ...Array.from(files)])
  }, [])

  const addFilesFromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    e.target.value = ""
  }

  if (loading) {
    return <LoadingLogo />
  }

  return (
    <>
      <div className="min-h-screen bg-slate-100/90 font-manrope dark:bg-slate-950/40">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          {/* Top bar: search + tabs (in-page) */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search files or assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#0056D2] focus:outline-none focus:ring-2 focus:ring-[#0056D2]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-full bg-white p-1 shadow-sm dark:bg-slate-900">
              {(
                [
                  ["all", "All files"],
                  ["recent", "Recent"],
                  ["shared", "Shared"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFileTab(key)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    fileTab === key
                      ? "text-[#0056D2] underline decoration-2 underline-offset-8"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="h-11 shrink-0 rounded-full px-6 font-semibold text-white shadow-md"
              style={{ backgroundColor: PRIMARY }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload asset
            </Button>
          </div>

          {/* Main card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0056D2] dark:text-blue-400">
                  Digital archive
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                  Assets
                </h1>
              </div>
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                    viewMode === "table"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  <List className="h-4 w-4" />
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                    viewMode === "grid"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid
                </button>
              </div>
            </div>

            {/* Chips */}
            <div className="mt-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearCategoryFilters}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                  selectedCategories.length === 0
                    ? "text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                )}
                style={selectedCategories.length === 0 ? { backgroundColor: PRIMARY } : undefined}
              >
                All assets
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                    selectedCategories.includes(c.id)
                      ? "border-[#0056D2] bg-blue-50 text-[#0056D2] dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Table */}
            {viewMode === "table" && (
              <div className="mt-8 overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                      <th className="px-4 py-3">Asset name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Storage size</th>
                      <th className="px-4 py-3">Date added</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                          No files match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => {
                        const { Icon, box, desc } = fileKind(asset.file_ext)
                        return (
                          <tr
                            key={asset.id}
                            className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                            onClick={() => setPreviewAsset(asset)}
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white",
                                    box
                                  )}
                                >
                                  <Icon className="h-5 w-5" strokeWidth={2} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-slate-50">
                                    {asset.title}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                                  {asset.organization_id && (
                                    <p className="mt-0.5 text-[11px] text-slate-400">
                                      {orgNames[asset.organization_id] || "Shared workspace"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {categoryLabel(asset.category)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                              {formatFileSize(asset.size_bytes)}
                            </td>
                            <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                              {new Date(asset.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuItem
                                    className="rounded-lg"
                                    onClick={() => setPreviewAsset(asset)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    Open preview
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-lg text-destructive focus:text-destructive"
                                    onClick={() => handleDelete(asset.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Grid */}
            {viewMode === "grid" && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAssets.length === 0 ? (
                  <p className="col-span-full py-12 text-center text-slate-500">No files match your filters.</p>
                ) : (
                  filteredAssets.map((asset) => {
                    const { Icon, box } = fileKind(asset.file_ext)
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setPreviewAsset(asset)}
                        className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition-all hover:border-[#0056D2]/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/40"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white",
                              box
                            )}
                          >
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-50">{asset.title}</p>
                            <p className="text-xs text-slate-500">{categoryLabel(asset.category)}</p>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatFileSize(asset.size_bytes)} ·{" "}
                              {new Date(asset.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload modal */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(o) => {
          setUploadOpen(o)
          if (!o) {
            setPendingFiles([])
            setDragActive(false)
          }
        }}
      >
        <DialogContent className="max-h-[min(92vh,720px)] gap-0 overflow-y-auto rounded-2xl border border-slate-200 p-0 sm:max-w-lg dark:border-slate-800">
          <DialogHeader className="border-b border-slate-100 px-6 pb-4 pt-6 text-left dark:border-slate-800">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Upload files
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
              Add files to your library. Transfers use encrypted HTTPS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 px-6 py-6">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                1. File upload
              </p>
              <div
                className={cn(
                  "mt-3 flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors",
                  dragActive
                    ? "border-[#0056D2] bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.fig,.svg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                  onChange={addFilesFromInput}
                  className="hidden"
                />
                <CloudUpload className="mb-3 h-10 w-10 text-[#0056D2]" />
                <p className="text-center font-semibold text-slate-900 dark:text-slate-50">
                  Drag and drop files here
                </p>
                <p className="mt-1 max-w-sm text-center text-xs text-slate-500 dark:text-slate-400">
                  Files are sent securely to your workspace storage.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-full border-slate-300"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select files from device
                </Button>
                <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Max 500MB
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    JPG, PNG, PDF, ZIP…
                  </span>
                </div>
                {pendingFiles.length > 0 && (
                  <ul className="mt-4 w-full max-w-sm space-y-1 text-left text-xs text-slate-600 dark:text-slate-300">
                    {pendingFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="truncate">
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                2. Category
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {categories.slice(0, 8).map((c) => {
                  const selected = uploadCategory === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setUploadCategory(c.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                        selected
                          ? "border-[#0056D2] bg-blue-50/50 shadow-sm dark:bg-blue-950/30"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          selected ? "bg-[#0056D2] text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-950/50"
                        )}
                      >
                        <FileUp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-50">{c.name}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {c.description || "Use this category for uploaded files."}
                        </p>
                      </div>
                      {selected && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0056D2] text-white">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Shield className="h-4 w-4 shrink-0 text-slate-400" />
              <span>HTTPS encryption in transit</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full px-6 font-semibold text-white"
                style={{ backgroundColor: PRIMARY }}
                disabled={uploading}
                onClick={() => void completeUpload()}
              >
                {uploading ? "Uploading…" : "Complete upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <X size={20} />
            </button>
            <div className="p-4 pt-14">
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
  )
}

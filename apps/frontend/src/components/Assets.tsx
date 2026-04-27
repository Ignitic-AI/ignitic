"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  Upload,
  Trash2,
  FileUp,
  CloudUpload,
  Search,
  LayoutGrid,
  List,
  MoreHorizontal,
  Download,
  Link2,
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

interface Asset {
  id: string
  organization_id?: string | null
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
  const organizationId = currentOrg?.id ?? null
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [search, setSearch] = useState("")
  const [fileTab, setFileTab] = useState<"all" | "recent" | "shared">("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")
  const [assetScope, setAssetScope] = useState<"current_org" | "all">(
    currentOrg?.id ? "current_org" : "all"
  )
  const [linkingAssetIds, setLinkingAssetIds] = useState<string[]>([])

  useEffect(() => {
    setAssetScope(organizationId ? "current_org" : "all")
  }, [organizationId])

  const fetchAssets = useCallback(async () => {
    if (!session?.user?.token) return
    const effectiveScope = assetScope === "current_org" && organizationId ? "org" : "all"
    setLoading(true)
    try {
      const response = await axios.get(`${API}/assets`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${session.user.token}`,
        },
        params: {
          scope: effectiveScope,
          organization_id: effectiveScope === "org" ? organizationId : undefined,
        },
      })
      const incomingAssets: Asset[] = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.assets)
          ? response.data.assets
          : []
      const scopedAssets =
        effectiveScope === "org" && organizationId
          ? incomingAssets.filter((asset) => asset.organization_id === organizationId)
          : incomingAssets
      setAssets(scopedAssets)
    } catch (err) {
      console.error("Error fetching assets:", err)
    } finally {
      setLoading(false)
    }
  }, [assetScope, organizationId, session?.user?.token])

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
    const ids = assets
      .map((asset) => asset.organization_id)
      .filter((id): id is string => Boolean(id))
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
  const activeScopeLabel =
    assetScope === "current_org" && organizationId ? "current organization" : "all content"
  const emptyStateMessage =
    selectedCategories.length > 0 || search.trim() || fileTab !== "all"
      ? `No assets found in ${activeScopeLabel} for the current filters.`
      : `No assets available in ${activeScopeLabel}.`

  const downloadAsset = (asset: Asset) => {
    if (!asset.url) {
      toast.error("File URL is unavailable")
      return
    }

    const link = document.createElement("a")
    link.href = asset.url
    const cleanExt = asset.file_ext?.replace(".", "") || ""
    link.download = cleanExt ? `${asset.title}.${cleanExt}` : asset.title
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const attachAssetToCurrentOrg = async (asset: Asset) => {
    if (!organizationId || !session?.user?.token) return

    setLinkingAssetIds((prev) => [...prev, asset.id])
    const payload = { organization_id: organizationId }

    try {
      const response = await axios.put(`${API}/assets/${asset.id}`, payload, {
        headers: { Authorization: `Bearer ${session.user.token}` },
      })
      const updatedAsset: Partial<Asset> | null = response.data

      setAssets((prev) =>
        prev.map((existing) =>
          existing.id === asset.id
            ? { ...existing, ...(updatedAsset || {}), organization_id: organizationId }
            : existing
        )
      )
      await fetchAssets()
      toast.success("Asset added to current organization")
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || error.response?.data?.message
        : null
      toast.error(message || "Could not add asset to the current organization")
    } finally {
      setLinkingAssetIds((prev) => prev.filter((id) => id !== asset.id))
    }
  }

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
      <div className="flex w-full min-w-0 flex-1 flex-col bg-transparent py-8 font-generalSans">
        <div className="w-full min-w-0 space-y-6">
          {/* Top bar: search + tabs (in-page) */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search files or assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm text-text-lm shadow-sm placeholder:text-text-muted-lm focus:border-primary-lm focus:outline-none focus:ring-2 focus:ring-primary-lm/20 dark:border-zinc-700 dark:bg-bg-light dark:text-text"
              />
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex rounded-full p-1 backdrop-blur-md bg-white/20 dark:bg-white/10 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-7 px-3 text-xs flex-1 rounded-full transition-colors",
                    assetScope === "current_org"
                      ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                      : "bg-transparent text-text-muted-lm dark:text-text-muted"
                  )}
                  onClick={() => setAssetScope("current_org")}
                  disabled={!organizationId}
                >
                  Current Organization
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-7 px-3 text-xs flex-1 rounded-full transition-colors",
                    assetScope === "all"
                      ? "bg-white/60 dark:bg-white/20 text-text-lm dark:text-text"
                      : "bg-transparent text-text-muted-lm dark:text-text-muted"
                  )}
                  onClick={() => setAssetScope("all")}
                >
                  All Content
                </Button>
              </div>
              
            </div>
            <Button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="h-11 shrink-0 rounded-xl px-6 font-semibold text-white shadow-md bg-primary-lm dark:bg-primary"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload asset
            </Button>
          </div>

          {/* Main card */}
          <div className="rounded-[4px] border border-zinc-200/80 bg-bg-light-lm p-6 shadow-lg shadow-zinc-200/40 dark:border-zinc-800 dark:bg-bg-light dark:shadow-none sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-lm dark:text-primary">
                  Digital archive
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-lm dark:text-text sm:text-4xl">
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
                  "rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                  selectedCategories.length === 0
                    ? "bg-primary-lm text-white dark:bg-primary"
                    : "border border-zinc-200 bg-white text-text-lm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-bg-light dark:text-text"
                )}
              >
                All assets
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                    selectedCategories.includes(c.id)
                      ? "border-primary-lm bg-primary-lm/10 text-primary-lm dark:bg-primary/10 dark:text-primary"
                      : "border-zinc-200 bg-white text-text-muted-lm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-bg-light dark:text-text-muted"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Table */}
            {viewMode === "table" && (
              <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-text-muted-lm dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-text-muted">
                      <th className="px-4 py-3">Asset name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Storage size</th>
                      <th className="px-4 py-3">Date added</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                          {emptyStateMessage}
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => {
                        const { Icon, box, desc } = fileKind(asset.file_ext)
                        const canAttachToOrg =
                          Boolean(organizationId) && asset.organization_id !== organizationId
                        const isLinking = linkingAssetIds.includes(asset.id)
                        return (
                          <tr
                            key={asset.id}
                            className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-bg-light/40"
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
                                  <p className="font-semibold text-text-lm dark:text-text">
                                    {asset.title}
                                  </p>
                                  <p className="text-xs text-text-muted-lm dark:text-text-muted">{desc}</p>
                                  {asset.organization_id && (
                                    <p className="mt-0.5 text-[11px] text-text-muted-lm/70">
                                      {orgNames[asset.organization_id] || "Shared workspace"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-xl bg-zinc-100 px-2.5 py-1 text-xs font-medium uppercase text-text-lm dark:bg-zinc-800 dark:text-text-muted">
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
                              <div className="inline-flex items-center gap-1">
                                {canAttachToOrg && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    disabled={isLinking}
                                    onClick={() => void attachAssetToCurrentOrg(asset)}
                                    aria-label="Add file to current organization"
                                    title="Add file to current organization"
                                  >
                                    <Link2 className="h-4 w-4" />
                                    <span className="ml-1 hidden md:inline">Add to org</span>
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => downloadAsset(asset)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl">
                                    <DropdownMenuItem
                                      className="rounded-lg text-destructive focus:text-destructive"
                                      onClick={() => handleDelete(asset.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
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
                  <p className="col-span-full py-12 text-center text-slate-500">{emptyStateMessage}</p>
                ) : (
                  filteredAssets.map((asset) => {
                    const { Icon, box } = fileKind(asset.file_ext)
                    const canAttachToOrg =
                      Boolean(organizationId) && asset.organization_id !== organizationId
                    const isLinking = linkingAssetIds.includes(asset.id)
                    return (
                      <div
                        key={asset.id}
                        className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition-all hover:border-[#0056D2]/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
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
                          <div className="flex items-center gap-1">
                            {canAttachToOrg && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg px-2 text-xs"
                                disabled={isLinking}
                                onClick={() => void attachAssetToCurrentOrg(asset)}
                                aria-label="Add file to current organization"
                                title="Add file to current organization"
                              >
                                <Link2 className="h-4 w-4" />
                                <span className="ml-1 hidden xl:inline">Add to org</span>
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => downloadAsset(asset)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
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
        <DialogContent className="max-h-[min(92vh,720px)] gap-0 overflow-y-auto rounded-2xl border border-zinc-200 p-0 sm:max-w-lg dark:border-zinc-800 dark:bg-bg-light font-generalSans">
          <DialogHeader className="border-b border-zinc-100 px-6 pb-4 pt-6 text-left dark:border-zinc-800">
            <DialogTitle className="text-xl font-bold text-text-lm dark:text-text">
              Upload files
            </DialogTitle>
            <DialogDescription className="text-sm text-text-muted-lm dark:text-text-muted">
              Add files to your library. Transfers use encrypted HTTPS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 px-6 py-6">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted-lm dark:text-text-muted">
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
                <CloudUpload className="mb-3 h-10 w-10 text-primary-lm dark:text-primary" />
                <p className="text-center font-semibold text-text-lm dark:text-text">
                  Drag and drop files here
                </p>
                <p className="mt-1 max-w-sm text-center text-xs text-text-muted-lm dark:text-text-muted">
                  Files are sent securely to your workspace storage.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-xl border-zinc-300"
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted-lm dark:text-text-muted">
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

          <div className="flex flex-col gap-3 border-t border-zinc-100 bg-bg-light-lm/80 px-6 py-4 dark:border-zinc-800 dark:bg-bg-light/80 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-text-muted-lm dark:text-text-muted">
              <Shield className="h-4 w-4 shrink-0 text-text-muted-lm/60" />
              <span>HTTPS encryption in transit</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl px-6 font-semibold text-white bg-primary-lm dark:bg-primary"
                disabled={uploading}
                onClick={() => void completeUpload()}
              >
                {uploading ? "Uploading…" : "Complete upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

"use client"

import { useState } from "react"
import { Upload, Plus, X, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import axios from "axios"
import { toast } from "sonner"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { API_V1_BASE_URL } from "@/lib/api"

// ─── Types matching backend schema ───────────────────────────────────────────

type InputField = {
  key: string
  type: string
  required: boolean
  description: string
  default: string
}

type OutputField = {
  key: string
  type: string
  description: string
}

const TYPE_OPTIONS = [
  "str",
  "int",
  "float",
  "bool",
  "List[str]",
  "List[int]",
  "Dict[str, Any]",
]

const EMPTY_INPUT: InputField = { key: "", type: "str", required: false, description: "", default: "" }
const EMPTY_OUTPUT: OutputField = { key: "", type: "str", description: "" }

// ─── Component ───────────────────────────────────────────────────────────────

interface ImportWorkflowDialogProps {
  children?: React.ReactNode
  onSuccess?: () => void
  disabled?: boolean
  disabledReason?: string
}

export function ImportWorkflowDialog({ children, onSuccess, disabled = false, disabledReason }: ImportWorkflowDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { data: session } = useSession()

  // Form fields
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [file, setFile] = useState<File | null>(null)

  // Input / Output schemas
  const [inputs, setInputs] = useState<InputField[]>([])
  const [outputs, setOutputs] = useState<OutputField[]>([])

  // Collapsible sections
  const [inputsOpen, setInputsOpen] = useState(false)
  const [outputsOpen, setOutputsOpen] = useState(false)

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setName("")
    setDescription("")
    setCategory("")
    setFile(null)
    setInputs([])
    setOutputs([])
    setInputsOpen(false)
    setOutputsOpen(false)
  }

  const addInput = () => {
    setInputs((prev) => [...prev, { ...EMPTY_INPUT }])
    setInputsOpen(true)
  }

  const removeInput = (idx: number) => setInputs((prev) => prev.filter((_, i) => i !== idx))

  const updateInput = (idx: number, patch: Partial<InputField>) =>
    setInputs((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))

  const addOutput = () => {
    setOutputs((prev) => [...prev, { ...EMPTY_OUTPUT }])
    setOutputsOpen(true)
  }

  const removeOutput = (idx: number) => setOutputs((prev) => prev.filter((_, i) => i !== idx))

  const updateOutput = (idx: number, patch: Partial<OutputField>) =>
    setOutputs((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))

  // ── Submit ──────────────────────────────────────────────────────────────

  const onSubmit = async () => {
    if (disabled) {
      toast.error(disabledReason || "Import is not allowed for your current plan.")
      return
    }

    // Basic validation
    if (!name.trim()) { toast.error("Name is required."); return }
    if (!description.trim()) { toast.error("Description is required."); return }
    if (!file) { toast.error("Workflow JSON file is required."); return }

    setIsLoading(true)
    try {
      const fileContent = await file.text()
      let n8nJson
      try {
        n8nJson = JSON.parse(fileContent)
      } catch {
        toast.error("Invalid JSON file.")
        setIsLoading(false)
        return
      }

      const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      const sanitizedCategory = (category || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      const igniticIdentifier = `n8n.workflow.${sanitizedCategory}.${sanitizedName}`

      // Build input schema map
      const inputsMap: Record<string, any> = {}
      for (const inp of inputs) {
        if (!inp.key.trim()) continue
        inputsMap[inp.key.trim()] = {
          type: inp.type,
          required: inp.required,
          description: inp.description,
          ...(inp.default ? { default: inp.default } : {}),
        }
      }

      // Build output schema map
      const outputsMap: Record<string, any> = {}
      for (const out of outputs) {
        if (!out.key.trim()) continue
        outputsMap[out.key.trim()] = {
          type: out.type,
          description: out.description,
        }
      }

      const payload: any = {
        name,
        description,
        workflow_data: n8nJson,
        ignitic_identifier: igniticIdentifier,
      }

      if (Object.keys(inputsMap).length > 0) payload.inputs = inputsMap
      if (Object.keys(outputsMap).length > 0) payload.outputs = outputsMap

      console.log("Import Payload:", payload)

      await axios.post(
        `${API_V1_BASE_URL}/workflow-template/n8n/import`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
            "Content-Type": "application/json",
          },
        }
      )

      toast.success("Workflow imported successfully")
      setOpen(false)
      resetForm()
      onSuccess?.()
    } catch (error: any) {
      console.error("Import error:", error)
      if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
        const errorMessages = error.response.data.detail.map((err: any) => `${err.loc.join(".")}: ${err.msg}`).join("\n")
        toast.error(`Validation Error:\n${errorMessages}`)
      } else {
        toast.error(error.response?.data?.message || "Failed to import workflow")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && disabled) {
          toast.error(disabledReason || "Import is not allowed for your current plan.")
          return
        }
        if (!nextOpen) resetForm()
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        {children || <Button variant="outline">Import Workflow</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Workflow</DialogTitle>
          <DialogDescription>
            Upload an n8n workflow JSON file and define its input/output schema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="wf-name">Name <span className="text-red-500">*</span></Label>
            <Input id="wf-name" placeholder="My Custom Email Tool" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="wf-desc">Description <span className="text-red-500">*</span></Label>
            <Input id="wf-desc" placeholder="Sends a personalized email to a customer" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* File */}
          <div className="space-y-1.5">
            <Label htmlFor="wf-file">Workflow JSON <span className="text-red-500">*</span></Label>
            <Input
              id="wf-file"
              type="file"
              accept=".json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="wf-cat">Category (optional)</Label>
            <Input id="wf-cat" placeholder="e.g. marketer" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          {/* ─── Inputs Section ───────────────────────────────────────── */}
          <div className="border rounded-lg">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
              onClick={() => setInputsOpen(!inputsOpen)}
            >
              <span>Inputs ({inputs.length})</span>
              {inputsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {inputsOpen && (
              <div className="px-3 pb-3 space-y-3">
                {inputs.map((inp, idx) => (
                  <div key={idx} className="relative border rounded-md p-3 space-y-2 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => removeInput(idx)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Parameter Name</Label>
                        <Input
                          placeholder="e.g. recipient_email"
                          className="h-8 text-sm"
                          value={inp.key}
                          onChange={(e) => updateInput(idx, { key: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={inp.type} onValueChange={(v) => updateInput(idx, { type: v })}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="What this parameter does"
                        className="h-8 text-sm"
                        value={inp.description}
                        onChange={(e) => updateInput(idx, { description: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Default (optional)</Label>
                        <Input
                          placeholder="Default value"
                          className="h-8 text-sm"
                          value={inp.default}
                          onChange={(e) => updateInput(idx, { default: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-1">
                        <Checkbox
                          id={`req-${idx}`}
                          checked={inp.required}
                          onCheckedChange={(v) => updateInput(idx, { required: !!v })}
                        />
                        <Label htmlFor={`req-${idx}`} className="text-xs cursor-pointer">Required</Label>
                      </div>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={addInput}>
                  <Plus className="w-3.5 h-3.5" /> Add Input
                </Button>
              </div>
            )}
          </div>

          {/* ─── Outputs Section ──────────────────────────────────────── */}
          <div className="border rounded-lg">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
              onClick={() => setOutputsOpen(!outputsOpen)}
            >
              <span>Outputs ({outputs.length})</span>
              {outputsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {outputsOpen && (
              <div className="px-3 pb-3 space-y-3">
                {outputs.map((out, idx) => (
                  <div key={idx} className="relative border rounded-md p-3 space-y-2 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => removeOutput(idx)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Field Name</Label>
                        <Input
                          placeholder="e.g. send_status"
                          className="h-8 text-sm"
                          value={out.key}
                          onChange={(e) => updateOutput(idx, { key: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={out.type} onValueChange={(v) => updateOutput(idx, { type: v })}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="What this output represents"
                        className="h-8 text-sm"
                        value={out.description}
                        onChange={(e) => updateOutput(idx, { description: e.target.value })}
                      />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={addOutput}>
                  <Plus className="w-3.5 h-3.5" /> Add Output
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

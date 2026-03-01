"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Upload, FileJson, X, Loader2 } from "lucide-react"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  tags: z.string().optional(), // We'll parse this string into an array
  file: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, "File is required")
    .refine(
      (files) => files?.[0]?.type === "application/json" || files?.[0]?.name.endsWith(".json"),
      "Must be a JSON file"
    ),
})

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      tags: "",
    },
  })

  const fileRef = form.register("file")

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (disabled) {
      toast.error(disabledReason || "Import is not allowed for your current plan.")
      return
    }
    setIsLoading(true)
    try {
      const file = values.file[0]
      const fileContent = await file.text()
      let n8nJson
      try {
        n8nJson = JSON.parse(fileContent)
      } catch (e) {
        form.setError("file", { message: "Invalid JSON file" })
        setIsLoading(false)
        return
      }

      const tagsArray = values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : []

      const sanitizedName = values.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      const sanitizedCategory = (values.category || "general").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      const igniticIdentifier = `n8n.workflow.${sanitizedCategory}.${sanitizedName}`

      const payload = {
        name: values.name,
        description: values.name, // Default description to name
        workflow_data: n8nJson,
        category: values.category || undefined,
        tags: tagsArray,
        ignitic_identifier: igniticIdentifier,
      }

      console.log("Import Payload:", payload)

      await axios.post(
        "http://localhost:8080/api/v1/workflow-template/n8n/import",
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
      form.reset()
      onSuccess?.()
    } catch (error: any) {
      console.error("Import error:", error)
      if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
        const errorMessages = error.response.data.detail.map((err: any) => `${err.loc.join(".")}: ${err.msg}`).join("\n")
        toast.error(`Validation Error:\n${errorMessages}`)
        console.log("Detail: ",error.response.data.detail)
      } else {
        toast.error(error.response?.data?.message || "Failed to import workflow")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && disabled) {
          toast.error(disabledReason || "Import is not allowed for your current plan.")
          return
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        {children || <Button variant="outline">Import Workflow</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Workflow</DialogTitle>
          <DialogDescription>
            Upload an n8n workflow JSON file to import it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Workflow" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, onBlur, name, ref } }) => (
                <FormItem>
                  <FormLabel>Workflow JSON</FormLabel>
                  <FormControl>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                      <Input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          onChange(e.target.files)
                        }}
                        onBlur={onBlur}
                        name={name}
                        ref={ref}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Automation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="tag1, tag2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

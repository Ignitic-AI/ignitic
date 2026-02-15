"use client"

import { MoreVertical, Download, Copy, Trash2, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useState } from "react"
import Link from "next/link"

export default function TemplateCard({ template, type }: { template: any, type: any }) {
  const [isHovered, setIsHovered] = useState(false)

  const isUserTemplate = type === "user"

  return (
    <Link href={`/analytics/template/${template.id}`}>
      <Card
        className="group relative overflow-hidden border border-border/60 bg-card hover:border-border/100 hover:shadow-md transition-all duration-300 cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-foreground/10 to-transparent" />

        <div className="p-6 flex flex-col h-full">
          {/* Icon and header */}
          <div className="flex items-start justify-between mb-4">
            <div className="text-3xl">{template.icon}</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isUserTemplate ? (
                  <>
                    <DropdownMenuItem>
                      <Download className="w-4 h-4 mr-2 font-generalSans" />
                      Export Template
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="w-4 h-4 mr-2 font-generalSans" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive font-generalSans">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem>
                      <Download className="w-4 h-4 mr-2 font-generalSans" />
                      Use Template
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="w-4 h-4 mr-2 font-generalSans" />
                      Preview
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Template info */}
          <h3 className="font-light text-foreground text-base mb-1 line-clamp-2 font-generalSans">{template.name}</h3>
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2 font-generalSans">{template.description}</p>

          {/* Footer metadata */}
          <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            {isUserTemplate ? (
              <>
                <span className="font-generalSans">Modified {template.lastModified}</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 " />
                  <span className="font-generalSans">{template.uses} uses</span>
                </div>
                <span className="text-muted-foreground/60 font-generalSans">{template.author}</span>
              </>
            )}
          </div>
        </div>

        {/* Hover overlay with action */}
        {isHovered && (
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/5 to-transparent pointer-events-none" />
        )}
      </Card>
    </Link>
  )
}

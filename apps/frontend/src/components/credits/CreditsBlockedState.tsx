"use client"

import Link from "next/link"
import { Ban, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CreditsBlockedStateProps {
  title?: string
  message: string
}

export function CreditsBlockedState({ title = "Access blocked", message }: CreditsBlockedStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 font-generalSans">
      <Card className="w-full max-w-xl border-border-lm dark:border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Ban className="h-5 w-5 text-danger" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-muted-lm dark:text-text-muted">{message}</p>
          <Link href="/profile">
            <Button className="gap-2 bg-info-lm dark:bg-info hover:opacity-90">
              <Wallet className="h-4 w-4" />
              Open Credits
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

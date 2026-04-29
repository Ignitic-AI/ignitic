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
            <Button className="gap-2 rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] font-generalSans font-medium text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]">
              <Wallet className="h-4 w-4" />
              Open Credits
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

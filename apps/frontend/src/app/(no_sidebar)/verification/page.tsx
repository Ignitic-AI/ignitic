"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MailCheck, Loader2 } from "lucide-react"
import axios from "axios"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { API_V1_BASE_URL } from "@/lib/api"

function errorText(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { error?: string; message?: string } | undefined
    return d?.error ?? d?.message ?? err.message ?? fallback
  }
  return fallback
}

export default function VerificationPage() {
  const [code, setCode] = useState("")
  const [message, setMessage] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const router = useRouter()

  const handleVerify = async () => {
    setMessage("")
    setIsVerifying(true)

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setMessage("Please enter a valid 6-digit numeric code.")
      setIsVerifying(false)
      return
    }

    try {
      const res = await axios.post(`${API_V1_BASE_URL}/auth/verify-email`, {
        token: code,
      })

      const data = res.data as { token?: string; message?: string }

      if (res.status === 200 && data.token) {
        const signInResult = await signIn("credentials", {
          accessToken: data.token,
          redirect: false,
        })
        if (!signInResult?.ok) {
          setMessage("Email verified, but sign-in failed. Please sign in manually.")
          setIsVerifying(false)
          return
        }
        setMessage("Email verified successfully! Redirecting...")
        router.push("/onboarding/1")
        setIsVerifying(false)
        return
      }

      if (
        res.status === 200 &&
        typeof data.message === "string" &&
        data.message.toLowerCase().includes("already verified")
      ) {
        router.push("/signin")
        setIsVerifying(false)
        return
      }

      setMessage("Verification failed. Please try again.")
    } catch (err) {
      console.error("Verification failed:", err)
      setMessage(errorText(err, "Verification failed."))
    }

    setIsVerifying(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 via-gray-300 to-blue-600 flex items-center justify-center p-4 font-generalSans">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <MailCheck className="mx-auto h-12 w-12 text-blue-600 mb-4" />
          <CardTitle className="text-2xl font-bold">Verify your email</CardTitle>
          <CardDescription>
            Please enter the 6-digit code sent to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="otp" className="sr-only">
              Verification Code
            </Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(val) => {
                  setCode(val)
                  setMessage("")
                }}
              >
                <InputOTPGroup>
                  {[...Array(6)].map((_, idx) => (
                    <InputOTPSlot key={idx} index={idx} className="w-14 h-14 text-xl border-highlight" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {message && (
              <p
                className={`text-sm mt-2 ${
                  message.includes("successfully") ? "text-green-600" : "text-red-600"
                }`}
              >
                {message}
              </p>
            )}
          </div>
          <Button
            onClick={handleVerify}
            className="w-full rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] font-generalSans font-semibold text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]"
            disabled={isVerifying || code.length !== 6}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

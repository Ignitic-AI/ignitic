"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MailCheck, Loader2 } from "lucide-react"
import axios from "axios"
import { useRouter } from "next/navigation"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

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
      const res = await axios.post("http://localhost:8080/api/v1/auth/verify-email", {
        token: code,
      })

      if (res.status === 200) {
        setMessage("Email verified successfully! Redirecting...")
        setTimeout(() => router.push("/"), 1000)
      } else {
        setMessage("Verification failed. Please try again.")
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error("Verification failed:", err.response?.data || err.message)
        setMessage(err.response?.data?.message || "Verification failed.")
      } else {
        console.error("Unexpected error:", err)
        setMessage("Unexpected error occurred.")
      }
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
            className="w-full bg-blue-600 hover:bg-blue-700"
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

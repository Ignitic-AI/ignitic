"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import axios from "axios"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Mail,
  KeyRound,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  RefreshCcw,
} from "lucide-react"
import { API_V1_BASE_URL } from "@/lib/api"

type Step = "email" | "reset" | "success"

export default function ResetPasswordPage() {
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Resend token cooldown
  const [cooldown, setCooldown] = useState<number>(0)

  // Basic validators
  const isValidEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email])
  const passwordScore = useMemo(() => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score // 0-5
  }, [password])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)

    if (!isValidEmail) {
      setEmailError("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)
    try {
      // Adjust endpoint to your backend if different
      await axios.post(`${API_V1_BASE_URL}/auth/forgot-password`, {
        email: email.trim(),
      })
      toast.success("Reset token sent to your email")
      setStep("reset")
      setCooldown(60)
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to send reset token"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendToken = async () => {
    if (cooldown > 0 || !isValidEmail) return
    try {
      await axios.post(`${API_V1_BASE_URL}/auth/forgot-password`, {
        email: email.trim(),
      })
      toast.success("Token resent")
      setCooldown(60)
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to resend token"
      toast.error(message)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setTokenError(null)
    setPasswordError(null)

    if (!token.trim()) {
      setTokenError("Token is required")
      return
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }

    setIsSubmitting(true)
    try {
      // Adjust endpoint to your backend if different
      await axios.post(`${API_V1_BASE_URL}/auth/reset-password`, {
        email: email.trim(),
        token: token.trim(),
        new_password: password,
      })
      toast.success("Password reset successful")
      setStep("success")
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to reset password"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const strengthLabel = useMemo(() => {
    switch (passwordScore) {
      case 0:
      case 1:
        return { text: "Very weak", color: "bg-red-500" }
      case 2:
        return { text: "Weak", color: "bg-orange-500" }
      case 3:
        return { text: "Medium", color: "bg-yellow-500" }
      case 4:
        return { text: "Strong", color: "bg-green-500" }
      case 5:
        return { text: "Very strong", color: "bg-emerald-500" }
      default:
        return { text: "Weak", color: "bg-orange-500" }
    }
  }, [passwordScore])

  return (
    <div className="min-h-screen font-generalSans bg-bg-dark-lm dark:bg-bg-dark text-text-lm dark:text-text">
      <div className="max-w-xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold">Reset Password</h1>
          <p className="text-text-muted-lm dark:text-text-muted mt-1">
            Securely reset your password in two quick steps.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.div
              key="step-email"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-400" />
                    Enter your email
                  </CardTitle>
                  <CardDescription>We&apos;ll send a one-time reset token to your email address.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRequestToken} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-bg-dark-lm/50 dark:bg-bg-dark/50 border-gray-800 text-text-lm dark:text-text"
                        aria-invalid={!!emailError}
                        aria-describedby={emailError ? "email-error" : undefined}
                      />
                      {emailError && (
                        <p id="email-error" className="text-sm text-red-400">
                          {emailError}
                        </p>
                      )}
                      <p className="text-xs text-text-muted-lm dark:text-text-muted">
                        Make sure you have access to this inbox.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={!isValidEmail || isSubmitting}
                      className="w-full rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] font-generalSans font-semibold text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "reset" && (
            <motion.div
              key="step-reset"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-400" />
                    Verify token and set a new password
                  </CardTitle>
                  <CardDescription>
                    We&apos;ve sent a token to <span className="font-medium text-text-lm dark:text-text">{email}</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-md border border-gray-800 bg-bg-dark-lm/40 dark:bg-bg-dark/40 px-3 py-2">
                    <div className="flex items-center gap-2 text-text-muted-lm dark:text-text-muted">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">{email}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep("email")}
                      className="border-gray-700 hover:bg-gray-800 bg-transparent"
                    >
                      Change email
                    </Button>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="token">Token</Label>
                      <Input
                        id="token"
                        type="text"
                        placeholder="Enter the code from your email"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="bg-bg-dark-lm/50 dark:bg-bg-dark/50 border-gray-800 text-text-lm dark:text-text"
                        aria-invalid={!!tokenError}
                        aria-describedby={tokenError ? "token-error" : undefined}
                      />
                      {tokenError && (
                        <p id="token-error" className="text-sm text-red-400">
                          {tokenError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_password">New password</Label>
                      <div className="relative">
                        <Input
                          id="new_password"
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-bg-dark-lm/50 dark:bg-bg-dark/50 border-gray-800 text-text-lm dark:text-text pr-10"
                          aria-invalid={!!passwordError}
                          aria-describedby={passwordError ? "password-error" : undefined}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-800"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 text-text-muted-lm dark:text-text-muted" />
                          ) : (
                            <Eye className="w-4 h-4 text-text-muted-lm dark:text-text-muted" />
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <p id="password-error" className="text-sm text-red-400">
                          {passwordError}
                        </p>
                      )}

                      {/* Strength indicator */}
                      {password.length > 0 && (
                        <div className="space-y-1">
                          <div className="h-1.5 w-full bg-gray-800 rounded">
                            <div
                              className={`h-1.5 rounded ${strengthLabel.color}`}
                              style={{ width: `${(passwordScore / 5) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-text-muted-lm dark:text-text-muted">
                            Strength: <span className="font-medium">{strengthLabel.text}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between">
  <div className="text-xs text-text-muted-lm dark:text-text-muted">
    Didn&apos;t get the token?{" "}
    <button
      type="button"
      className="inline-flex items-center gap-1 align-baseline text-blue-400 hover:underline disabled:opacity-50 ml-2"
      onClick={handleResendToken}
      disabled={cooldown > 0 || !isValidEmail}
    >
      <RefreshCcw className="w-3 h-3 relative top-[1px]" />
      <span className="pt-[2px] ">Resend{cooldown > 0 ? ` in ${cooldown}s` : ""}</span>
    </button>
  </div>
  <div className="text-xs text-text-muted-lm dark:text-text-muted">
    Keep your token private.
  </div>
</div>


                    <Separator className="bg-gray-800" />

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] font-generalSans font-semibold text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          Reset Password
                          <KeyRound className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="step-success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-bg-light-lm dark:bg-bg-light border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success-lm dark:text-success" />
                    Password reset successful
                  </CardTitle>
                  <CardDescription>You can now sign in with your new password.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link href="/signin">
                    <Button className="w-full rounded-[4px] border-2 border-border dark:border-highlight-lm bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-dark)_100%)] font-generalSans font-semibold text-text shadow-[0px_1px_0px_rgba(255,255,255,0.06),0px_1px_1px_rgba(0,0,0,0.35),0px_3px_7px_rgba(0,0,0,0.28)] transition-opacity hover:opacity-90 dark:bg-[linear-gradient(180deg,var(--color-bg-light-lm)_0%,var(--color-bg-dark-lm)_100%)] dark:text-text-lm dark:shadow-[0px_1px_0px_rgba(225,225,225,0.7),0px_1px_1px_rgba(0,0,0,0.18),0px_3px_7px_rgba(179,179,179,0.9)]">
                      Go to Sign In
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

"use client"

import type React from "react"

import Image from "next/image"
import logo from "../../public/white-logo.png"
import rightBackground from "../../public/signup-page-img.jpg"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"


const Page = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
      } else {
        // On success, redirect to dashboard
        router.push("/")
      }
    } catch (err) {
      console.error("Sign in failed:", err)
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex min-h-[600px]">
          {/* Left Side - Sign In Form */}
          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              {/* Logo */}
              <div className="mb-8 flex items-center gap-3">
                <div className="w-8 h-8 bg-bg-dark rounded-md flex items-center justify-center mb-6">
                  <Image src={logo || "/placeholder.svg"} alt="Logo Icon" width={18} height={18} className="rounded" />
                </div>
                <div className="font-generalSans font-semibold text-2xl text-bg mb-6">Ignitic AI</div>
              </div>

              {/* Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-semibold font-generalSans text-bg-dark mb-2">Welcome Back</h1>
                <p className="text-gray-600 font-generalSans">Sign in to continue to Ignitic AI</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm font-generalSans">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6 font-generalSans">
                <div>
                  <Label htmlFor="email" className="text-sm text-bg-dark font-bold mb-2 block">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hi@igniticai.com"
                    required
                    className="text-bg-dark"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="password" className="text-sm font-bold text-bg-dark">
                      Password
                    </Label>
                    <button type="button"
                    onClick={() => router.push("/reset-password")}
                    className="text-sm text-gray-600 hover:text-gray-800 font-generalSans">
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="text-bg-dark"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bg-light hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-bg-dark hover:bg-blue-800 text-white py-3 rounded-lg font-medium font-generalSans"
                >
                  {loading ? <Spinner /> : "Sign In"}
                </Button>
              </form>

              {/* Sign Up Link */}
              <div className="mt-6 text-center">
                <span className="text-gray-600 font-generalSans">Don't have an account? </span>
                <button
                  onClick={() => router.push("/signup")}
                  className="text-gray-900 font-medium hover:underline font-generalSans"
                >
                  Sign up
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Marketing Content */}
          <div className="flex-1 relative overflow-hidden">
            <Image
              src={rightBackground}
              alt="Sign in background"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page

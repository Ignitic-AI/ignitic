"use client"

import Image from "next/image"
import logo from "../../../../public/white-logo.png"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import axios from "axios"
import { useRouter } from "next/navigation"

const Page = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() 
    setLoading(true)

    try {
      await axios.post("http://localhost:8080/api/v1/auth/register", {
        first_name: firstName,
        last_name: lastName,
        email,
        password
      })

      // On success, redirect to verification page
      router.push("/verification")
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error("Registration failed:", err.response?.data || err.message)
      } else {
        console.error("An unexpected error occurred", err)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex min-h-[600px]">
          {/* Left Side - Sign Up Form */}
          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              {/* Logo */}
              <div className="mb-8 flex items-center gap-3">
                <div className="w-8 h-8 bg-bg-dark rounded-md flex items-center justify-center mb-6">
                  <Image src={logo} alt="Logo Icon" width={18} height={18} className="rounded" />
                </div>
                <div className="font-generalSans font-semibold text-2xl text-bg mb-6">
                  Ignitic AI
                </div>
              </div>

              {/* Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-semibold font-generalSans text-bg-dark mb-2">
                  Get Started
                </h1>
                <p className="text-gray-600 font-generalSans">
                  Welcome to Ignitic AI - Let's create your account
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6 font-generalSans">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-bold mb-2 block">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-bold mb-2 block">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-bold mb-2 block">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hi@igniticai.com"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="password" className="text-sm font-bold text-gray-700">
                      Password
                    </Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
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
                  className="w-full bg-bg-dark hover:bg-blue-800 text-text py-3 rounded-lg font-medium font-generalSans"
                >
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </form>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <span className="text-gray-600">Already have an account? </span>
                <button className="text-gray-900 font-medium hover:underline font-generalSans">
                  Log in
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Marketing Content */}
          <div className="flex-1 bg-blue-800 relative overflow-hidden">
            {/* background */}
<div className="absolute inset-0 pointer-events-none noise-overlay"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page

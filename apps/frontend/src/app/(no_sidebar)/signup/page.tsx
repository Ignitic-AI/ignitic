"use client"

import Image from "next/image"
import logo from "../../../../public/white-logo.png"
import rightBackground from "../../../../public/signup-page-img.jpg"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import axios from "axios"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { API_V1_BASE_URL } from "@/lib/api"

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(10, "Password must be at least 10 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character")
    .refine((val) => !["password", "123456", "admin", "qwerty", "user"].includes(val.toLowerCase()), "Password cannot be a common password")
    .refine((val) => !/(.)\1\1\1/.test(val), "Password cannot contain more than 3 consecutive identical characters")
    .refine((val) => {
      const sequences = ["01234567890", "abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm"];
      const lowerVal = val.toLowerCase();
      for (const seq of sequences) {
        for (let i = 0; i <= seq.length - 4; i++) {
          if (lowerVal.includes(seq.substring(i, i + 4))) return false;
        }
      }
      return true;
    }, "Password cannot contain sequential characters (e.g., 1234, abcd)"),
})

type SignupFormValues = z.infer<typeof signupSchema>

const Page = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormValues, string>>>({})
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() 
    setLoading(true)
    setErrors({})

    const result = signupSchema.safeParse({
      firstName,
      lastName,
      email,
      password
    })

    if (!result.success) {
      const formattedErrors: Partial<Record<keyof SignupFormValues, string>> = {}
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof SignupFormValues
        formattedErrors[path] = issue.message
      })
      setErrors(formattedErrors)
      setLoading(false)
      return
    }

    try {
      await axios.post(`${API_V1_BASE_URL}/auth/register`, {
        first_name: firstName,
        last_name: lastName,
        email,
        password
      })

      // On success, redirect to verification page
      router.push("/verification")
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error("Registration failed:", err.response?.data)
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
                    <Label htmlFor="firstName" className="text-sm font-bold mb-2 block text-bg-dark">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className={`shadow-[0_4px_0_rgba(0,0,0,0.04),4px_4px_0_rgba(0,0,0,0.02)] text-bg-dark ${errors.firstName ? "border-red-500" : ""}`}
                    />
                    {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-bold mb-2 block text-bg-dark" >
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className={`shadow-[0_4px_0_rgba(0,0,0,0.04),4px_4px_0_rgba(0,0,0,0.02)] text-bg-dark ${errors.lastName ? "border-red-500" : ""}`}
                    />
                    {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-bold mb-2 block text-bg-dark">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hi@igniticai.com"
                    className={`shadow-[0_4px_0_rgba(0,0,0,0.04),4px_4px_0_rgba(0,0,0,0.02)] text-bg-dark ${errors.email ? "border-red-500" : ""}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="password" className="text-sm font-bold text-bg-dark">
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
                      className={`shadow-[0_4px_0_rgba(0,0,0,0.04),4px_4px_0_rgba(0,0,0,0.02)] text-bg-dark ${errors.password ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bg-light hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-bg-dark hover:bg-blue-800 text-white py-3 rounded-lg font-medium font-generalSans"
                >
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </form>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <span className="text-gray-600">Already have an account? </span>
                <button 
                  onClick={() => router.push("/signin")}
                  className="text-gray-900 font-medium hover:underline font-generalSans"
                >
                  Log in
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Marketing Content */}
          <div className="flex-1 relative overflow-hidden">
            <Image
              src={rightBackground}
              alt="Sign up background"
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

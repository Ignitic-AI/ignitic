"use client"

import Image from "next/image"
import logo from "../../../public/white-logo.png"
import { useState } from "react"
import { Eye, EyeOff} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


const page = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")


  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex min-h-[600px]">

          {/* Left Side - Sign Up Form */}
          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              
              {/* Logo and branding*/ }
              <div className="mb-8 flex items-center gap-3 ">
                <div className="w-8 h-8 bg-bg-dark rounded-md flex items-center justify-center mb-6">
                  <Image
      src={logo}
      alt="Logo Icon"
      width={18} 
      height={18} 
      className="icon-class rounded"  
    />
                </div>
                <div className="text-2xl font-bold text-bg mb-6">Ignitic AI</div>
                
              </div>

            {/*Form header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold font-generalSans text-bg-dark mb-2">Get Started</h1>
              <p className="text-gray-600 font-generalSans">Welcome to Ignitic AI - Let's create your account</p>
            </div>

            {/* Form */}
            <form className="space-y-6 font-generalSans">
              <div>
                <Label htmlFor="email" className="text-sm font-bold  mb-2 block">Email</Label>
                <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="hi@igniticai.com"
                  />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="password" className="text-sm font-bold text-gray-700">
                      Password
                    </Label>
                    <button type="button" className="text-sm text-gray-600 hover:text-gray-800">
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

              <Button className="w-full bg-bg-dark hover:bg-blue-800 text-text py-3 rounded-lg font-medium font-generalSans">
                  Sign up
                </Button>
            </form>

            {/* Login Link */}
              <div className="mt-6 text-center">
                <span className="text-gray-600">Already have an account? </span>
                <button className="text-gray-900 font-medium hover:underline font-generalSans">Log in</button>
              </div>
            </div>
          </div>


          {/* Right Side - Marketing Content */}
          <div className="flex-1 bg-blue-800 relative overflow-hidden">
  {/* SVG Background - moved to true background */}
  <svg className="absolute w-full h-full top-0 left-0 z-0">
                <defs>
                    <filter id="noiseFilter">
                        <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="5" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                </defs>
                <rect width="100%" height="100%" filter="url(#noiseFilter)" opacity="1.6" fill="white" />
            </svg>

            <div className="absolute inset-0 bg-gradient-to-br from-blue-700/80 to-blue-950/80 z-10">
                <div className="relative z-20 p-8 lg:p-12 h-full flex flex-col justify-center">
                    <div className="max-w-md">
                        <h2 className="text-4xl lg:text-5xl font-extrabold font-generalSans leading-tight mb-8 text-white">
                            Enter
                            the <br/>Future
                            of <br/>Ecommerce,<br/>
                            Today{" \u{1F60E}"}
                        </h2>
                    </div>
                </div>
            </div>
</div>
        </div>
      </div>
    </div>
  )
}

export default page
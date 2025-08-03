"use client"

import * as React from "react"
import { Building2, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


const platformOptions = [
  "Web Application",
  "Mobile App",
  "Desktop Software",
  "E-commerce Platform",
  "SaaS Platform",
  "API Service",
]

const brandLogos = [
  { name: "Shopify", logo: "S", color: "bg-green-500" },
  { name: "Stripe", logo: "St", color: "bg-blue-500" },
  { name: "PayPal", logo: "P", color: "bg-blue-600" },
  { name: "Square", logo: "Sq", color: "bg-black" },
  { name: "WooCommerce", logo: "W", color: "bg-purple-500" },
  { name: "Magento", logo: "M", color: "bg-orange-500" },
  { name: "BigCommerce", logo: "B", color: "bg-blue-400" },
  { name: "Salesforce", logo: "Sf", color: "bg-blue-700" },
]

const Step1 = () => {
  const [isOrg, setIsOrg] = React.useState(false)
  const [orgName, setOrgName] = React.useState("")
  const [platform, setPlatform] = React.useState("")
  const [workOnMultiplePlatforms, setWorkOnMultiplePlatforms] = React.useState(false)
  const [selectedBrands, setSelectedBrands] = React.useState<string[]>([])

  const progress = 25 // Step 1 of 4

  const handleBrandSelect = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName) ? prev.filter((name) => name !== brandName) : [...prev, brandName],
    )
  }

  const canProceed = isOrg ? orgName.trim() !== "" && platform !== "" : platform !== ""

  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Form */}
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-semibold text-gray-900 mb-3">Let's get to know you</h1>
                <p className="text-lg text-gray-600">Tell us about your organization and platform needs</p>
              </div>

              <div className="space-y-6">
                {/* Are you Org Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-org" className="text-base font-medium text-gray-700">
                    Are you Org?
                  </Label>
                  <Switch id="is-org" checked={isOrg} onCheckedChange={setIsOrg} />
                </div>

                {/* Org Name Input - Only show if isOrg is true */}
                {isOrg && (
                  <div className="space-y-2">
                    <Label htmlFor="org-name" className="text-base font-medium text-gray-700">
                      Org Name
                    </Label>
                    <Input
                      id="org-name"
                      type="text"
                      placeholder="Add text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                )}

                {/* Platform Dropdown */}
                <div className="space-y-2">
                  <Label htmlFor="platform" className="text-base font-medium text-gray-700">
                    Platform
                  </Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                      <SelectValue placeholder="Select your platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Work on Multiple Platforms Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="multiple-platforms" className="text-base font-medium text-gray-700">
                    Work on Multiple Platforms
                  </Label>
                  <Switch
                    id="multiple-platforms"
                    checked={workOnMultiplePlatforms}
                    onCheckedChange={setWorkOnMultiplePlatforms}
                  />
                </div>

                {/* Brand Selection - Only show if workOnMultiplePlatforms is true */}
                {workOnMultiplePlatforms && (
                  <div className="space-y-4">
                    <Label className="text-base font-medium text-gray-700">Select your platforms</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {brandLogos.map((brand) => (
                        <button
                          key={brand.name}
                          onClick={() => handleBrandSelect(brand.name)}
                          className={`
                            relative p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105
                            ${
                              selectedBrands.includes(brand.name)
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }
                          `}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 ${brand.color} rounded-lg flex items-center justify-center`}>
                              <span className="text-white font-bold text-sm">{brand.logo}</span>
                            </div>
                            <span className="text-xs font-medium text-gray-700">{brand.name}</span>
                          </div>
                          {selectedBrands.includes(brand.name) && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Illustration */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-48 h-48 bg-gray-900 rounded-3xl flex items-center justify-center">
                <Building2 className="w-24 h-24 text-white" />
              </div>
            </div>
          </div>
  )
}

export default Step1
"use client"

import Image from "next/image"
import Shopify from "../../public/logos/shopify-2.svg"
import Wix from "../../public/logos/wix-logo-1.svg"
import { useState } from "react"
import * as Switch from "@radix-ui/react-switch";
import { Building2, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


const platformOptions = [
  "Shopify",
  "Wix",
]

const brandLogos = [
  { name: "Shopify", logo: Shopify },
  { name: "Wix", logo: Wix },

]

const Step1 = () => {
  const [isOrg, setIsOrg] = useState(false)
  const [orgName, setOrgName] = useState("")
  const [platform, setPlatform] = useState("")
  const [workOnMultiplePlatforms, setWorkOnMultiplePlatforms] = useState(false)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])


  const handleBrandSelect = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName) ? prev.filter((name) => name !== brandName) : [...prev, brandName],
    )
  }



  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Form */}
            <div className="space-y-7">
              <div>
                <h1 className="text-3xl font-semibold text-gray-900 mb-3">Let's get to know you</h1>
                <p className="text-lg text-gray-600">Tell us about your organization and platform needs</p>
              </div>

              <div className="space-y-6">
                {/* Are you Org Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-org" className=" font-semibold text-xl text-gray-600">
                    Do you have an Organization?
                  </Label>
                  <Switch.Root className="SwitchRoot" id="is-org" checked={isOrg} onCheckedChange={setIsOrg}> 
  <Switch.Thumb className="SwitchThumb" /> 
</Switch.Root>
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
                  <Label htmlFor="platform" className="text-lg font-semibold text-gray-600">
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
                  <Label htmlFor="multiple-platforms" className="text-lg font-semibold text-gray-600">
                    Work on Multiple Platforms
                  </Label>
                  <Switch.Root className="SwitchRoot" id="multiple-platforms" checked={workOnMultiplePlatforms} onCheckedChange={setWorkOnMultiplePlatforms}> 
  <Switch.Thumb className="SwitchThumb" /> 
</Switch.Root>
                  
                </div>

                {/* Brand Selection - Only show if workOnMultiplePlatforms is true */}
                {workOnMultiplePlatforms && (
                  <div className="space-y-4">
                    <Label className="text-base font-medium text-gray-600">Select your platforms</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {brandLogos.map((brand) => (
                        <button
                          key={brand.name}
                          onClick={() => handleBrandSelect(brand.name)}
                          className={`
                            relative rounded-xl transition-all duration-200 hover:scale-105
                            ${
                              selectedBrands.includes(brand.name)
                                ? "border-emerald-400 bg-emerald-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }
                          `}
                        >
                          <div className="flex items-center justify-center w-16 h-16"> 
      <Image
        src={brand.logo}
        alt={brand.name}  
        fill 
        className="object-contain" // Ensure image fits nicely
      />
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
            {/* <div className="flex justify-center lg:justify-end">
              <div className="w-48 h-48 bg-gray-900 rounded-3xl flex items-center justify-center">
                <Building2 className="w-24 h-24 text-white" />
              </div>
            </div> */}
          </div>
  )
}

export default Step1
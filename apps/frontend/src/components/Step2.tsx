"use client"

import {useState} from "react"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"

const countries = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Australia",
  "Japan",
  "India",
  "Brazil",
  "Mexico",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Switzerland",
]

const hearAboutUsOptions = [
  "Facebook",
  "Google Search",
  "LinkedIn",
  "Twitter",
  "Instagram",
  "YouTube",
  "Friend/Colleague Referral",
  "Blog/Article",
  "Podcast",
  "Conference/Event",
  "Email Newsletter",
  "Advertisement",
  "Other",
]

const orgSizeOptions = [
  "Just me (1)",
  "Small team (2-10)",
  "Medium team (11-50)",
  "Large team (51-200)",
  "Enterprise (200+)",
]

const Step2 = () => {
  const [sizeOfOrg, setSizeOfOrg] = useState("")
  const [yourRole, setYourRole] = useState("")
  const [country, setCountry] = useState("")
  const [whereYouHearUs, setWhereYouHearUs] = useState("Facebook")



  return (
    <div className="font-generalSans">
    <div className="mb-12">
            <h1 className="text-3xl font-generalSans font-semibold text-text mb-3">Tell us more about yourself</h1>
            <p className="text-lg text-text-muted">Help us customize your experience</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-8">
            {/* Size of Org */}
            <div className="flex items-center gap-8">
              <Label htmlFor="size-of-org" className="text-xl font-semibold text-text-muted w-48 text-right">
                Size of Org
              </Label>
              <div className="flex-1 max-w-xs">
                <Select value={sizeOfOrg} onValueChange={setSizeOfOrg}>
                  <SelectTrigger className="w-full px-4 py-3 border border-border-muted rounded-lg bg-bg-light text-text focus:ring-2 focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="Add text" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgSizeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Your Role */}
            <div className="flex items-center gap-8">
              <Label htmlFor="your-role" className="text-xl font-semibold text-text-muted w-48 text-right">
                Your Role
              </Label>
              <div className="flex-1 max-w-xs">
                <Input
                  id="your-role"
                  type="text"
                  placeholder="Add text"
                  value={yourRole}
                  onChange={(e) => setYourRole(e.target.value)}
                  className="w-full px-4 py-3 border border-border-muted rounded-lg bg-bg-light text-text focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {/* Country */}
            <div className="flex items-center gap-8">
              <Label htmlFor="country" className=" font-semibold text-xl text-text-muted w-48 text-right">
                Country
              </Label>
              <div className="flex-1 max-w-xs">
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-full px-4 py-3 border border-border-muted rounded-lg bg-bg-light text-text focus:ring-2 focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((countryOption) => (
                      <SelectItem key={countryOption} value={countryOption}>
                        {countryOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Where you Hear Us */}
            <div className="flex items-center gap-8">
              <Label htmlFor="where-hear-us" className="text-xl font-semibold text-text-muted w-48 text-right">
                Where You Hear Us
              </Label>
              <div className="flex-1 max-w-xs">
                <Select value={whereYouHearUs} onValueChange={setWhereYouHearUs}>
                  <SelectTrigger className="w-full px-4 py-3 border border-border-muted rounded-lg bg-bg-light text-text focus:ring-2 focus:ring-primary focus:border-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hearAboutUsOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        
        </div>
  )
}

export default Step2
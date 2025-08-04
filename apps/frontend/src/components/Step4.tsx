"use client"

import {useState} from "react"
// import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"


const automationOptions = [
  { id: "payment-reminders", name: "Payment Reminders", category: "Payments" },
  { id: "invoice-generation", name: "Invoice Generation", category: "Invoicing" },
  { id: "expense-tracking", name: "Expense Tracking", category: "Finance" },
  { id: "recurring-payments", name: "Recurring Payments", category: "Payments" },
  { id: "tax-calculations", name: "Tax Calculations", category: "Finance" },
  { id: "budget-alerts", name: "Budget Alerts", category: "Finance" },
  { id: "client-notifications", name: "Client Notifications", category: "Communication" },
  { id: "report-generation", name: "Report Generation", category: "Analytics" },
  { id: "data-backup", name: "Data Backup", category: "Security" },
  
]


const Step4 = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOptions, setSelectedOptions] = useState<string[]>([
    "payment-reminders",
    "invoice-generation",
    "expense-tracking",
  ])

  const filteredOptions = automationOptions.filter(
    (option) =>
      option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions((prev) => (prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]))
  }

  return (
    <>
    <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold text-gray-900 mb-3">What you like to Automate?</h1>
          </div>

          {/* Search Bar */}
          {/* <div className="max-w-4xl mx-auto mb-12">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div> */}

          {/* Automation Options Grid */}
          <div className="max-w-5xl mx-auto mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleOptionToggle(option.id)}
                  className="flex items-center gap-3 p-4 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
                >
                  <div className="relative">
                    <div
                      className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                        selectedOptions.includes(option.id) ? "bg-gray-800 border-gray-800" : "bg-white border-gray-300"
                      }`}
                    >
                      {selectedOptions.includes(option.id) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{option.name}</div>
                    <div className="text-sm text-gray-500">{option.category}</div>
                  </div>
                </button>
              ))}
            </div>

            {filteredOptions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No automation options found matching your search.</p>
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedOptions.length > 0 && (
            <div className="text-center mt-2">
              <p className="text-gray-600">
                {selectedOptions.length} automation{selectedOptions.length > 1 ? "s" : ""} selected
              </p>
            </div>
          )}
        </>
  )
}

export default Step4
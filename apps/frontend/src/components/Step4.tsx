"use client"

import {useState} from "react"
import { Check, Bell, FileText, TrendingUp, Repeat, Calculator, BarChart3, Megaphone, Database, ChevronRight, ChevronDown, Search, ShoppingCart, Package, Truck, Gift, Star, Tag, Percent, CreditCard, Store, MessageSquare, RefreshCw, Boxes } from "lucide-react"
import { Input } from "@/components/ui/input"


const automationOptions = [
  
  { id: "abandoned-cart-recovery", name: "Abandoned Cart Recovery", category: "Retention", Icon: ShoppingCart, iconClasses: "bg-teal-50 text-teal-700 ring-teal-200" },
  { id: "upsell-cross-sell", name: "Upsell & Cross‑sell", category: "Marketing", Icon: Store, iconClasses: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" },
  { id: "order-confirmations", name: "Order Confirmations", category: "Operations", Icon: Package, iconClasses: "bg-lime-50 text-lime-700 ring-lime-200" },
  { id: "shipping-updates", name: "Shipping Updates", category: "Fulfillment", Icon: Truck, iconClasses: "bg-sky-50 text-sky-700 ring-sky-200" },
  { id: "low-stock-alerts", name: "Low Stock Alerts", category: "Inventory", Icon: Boxes, iconClasses: "bg-stone-50 text-stone-700 ring-stone-200" },
  { id: "price-drop-alerts", name: "Price Drop Alerts", category: "Product Research", Icon: Tag, iconClasses: "bg-pink-50 text-pink-700 ring-pink-200" },
  { id: "review-requests", name: "Review Requests", category: "Customer Support", Icon: Star, iconClasses: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  { id: "restock-notifications", name: "Back‑in‑Stock Alerts", category: "Inventory", Icon: RefreshCw, iconClasses: "bg-purple-50 text-purple-700 ring-purple-200" },
  { id: "loyalty-points", name: "Loyalty Points", category: "Loyalty", Icon: Gift, iconClasses: "bg-red-50 text-red-700 ring-red-200" },
  { id: "discount-code-generation", name: "Discount Code Generation", category: "Marketing", Icon: Percent, iconClasses: "bg-green-50 text-green-700 ring-green-200" },
  { id: "store-chatbot", name: "Store Chatbot", category: "Customer Support", Icon: MessageSquare, iconClasses: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
]


const Step4 = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOptions, setSelectedOptions] = useState<string[]>([
    "payment-reminders",
    "invoice-generation",
    "expense-tracking",
  ])
  const [showAll, setShowAll] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const categories = Array.from(new Set(automationOptions.map((o) => o.category)))

  const filteredOptions = automationOptions
    .filter(
      (option) =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.category.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .filter((option) => (activeCategory === "All" ? true : option.category === activeCategory))

  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions((prev) => (prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]))
  }

  const visibleOptions = searchTerm
    ? filteredOptions
    : showAll
    ? filteredOptions
    : filteredOptions.slice(0, 8)

  return (
    <>
    <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold text-gray-900 mb-3">What you like to Automate?</h1>
          </div>

          {/* Search Bar */}
          <div className="max-w-5xl mx-auto mb-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search automations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category Filters */}
          <div className="max-w-5xl mx-auto mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveCategory("All")}
              aria-pressed={activeCategory === "All"}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === "All"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Automation Options Grid */}
          <div className="max-w-5xl mx-auto mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {visibleOptions.map((option) => {
                const isSelected = selectedOptions.includes(option.id)
                const Icon = (option as any).Icon as any
                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionToggle(option.id)}
                    aria-pressed={isSelected}
                    className={`relative group rounded-xl border p-4 text-left transition-all duration-200 bg-gradient-to-br from-white to-gray-50 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${
                      isSelected ? "border-emerald-600 ring-2 ring-emerald-200 bg-emerald-50/30" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ${(option as any).iconClasses}`}>
                        {Icon && <Icon className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{option.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{option.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`absolute right-3 top-3 h-5 w-5 rounded-full border flex items-center justify-center shadow-sm transition-all ${
                      isSelected ? "bg-emerald-600 border-emerald-600 text-white scale-100" : "bg-white border-gray-300 text-transparent scale-90 group-hover:scale-95"
                    }`}>
                      <Check className={`h-3.5 w-3.5 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60 text-gray-400"}`} />
                    </div>
                  </button>
                )
              })}
            </div>

            {filteredOptions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No automation options found matching your search.</p>
              </div>
            )}
            {filteredOptions.length > 8 && !searchTerm && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  {showAll ? (
                    <>
                      Show less
                      <ChevronDown className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Show more
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
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
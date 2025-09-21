'use client'

export function AISuggestions() {
  const suggestions = [
    {
      title: "Customer Onboarding",
      count: "24 Workflows",
      description: "Automate welcome emails, account setup, and first purchase guidance",
      icon: "👋",
      bgColor: "bg-yellow-100",
      iconColor: "text-orange-500"
    },
    {
      title: "Order Processing",
      count: "18 Workflows", 
      description: "Streamline order confirmation, shipping updates, and delivery tracking",
      icon: "📦",
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      title: "Inventory Management",
      count: "12 Workflows",
      description: "Automate stock alerts, reorder notifications, and low inventory warnings",
      icon: "📊",
      bgColor: "bg-purple-100", 
      iconColor: "text-purple-600"
    },
    {
      title: "Customer Support",
      count: "8 Workflows",
      description: "Auto-respond to common queries, route tickets, and follow-up reminders",
      icon: "🎧",
      bgColor: "bg-teal-100",
      iconColor: "text-teal-600"
    }
  ]

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-slate-300">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-slate-800 mb-2">AI Suggestions</h3>
        <p className="text-slate-600">Ecommerce Automation Workflows</p>
      </div>

      {/* Suggestions Grid */}
      <div className="grid grid-cols-2 gap-4">
        {suggestions.map((suggestion, index) => (
          <div 
            key={index}
            className={`${suggestion.bgColor} p-4 rounded-xl border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group`}
          >
            <div className="flex items-start gap-3">
              <div className={`text-2xl ${suggestion.iconColor}`}>
                {suggestion.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-500 mb-1">
                  {suggestion.count}
                </div>
                <h4 className="font-semibold text-slate-800 mb-2 group-hover:text-slate-900 transition-colors">
                  {suggestion.title}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {suggestion.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View All Button */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <button className="w-full text-center text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors duration-200 hover:underline">
          View All Suggestions
        </button>
      </div>
    </div>
  )
}

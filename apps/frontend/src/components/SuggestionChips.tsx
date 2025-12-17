"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Megaphone, Package, Headset, Target } from "lucide-react"

type CategoryType = "Marketing" | "Product" | "Customer Support" | "Advertising" | null

interface SuggestionPrompts {
  [key: string]: string[]
}

const categoryIcons = {
  Marketing: Megaphone,
  Product: Package,
  "Customer Support": Headset,
  Advertising: Target,
}

const prompts: SuggestionPrompts = {
  Marketing: [
    "What are the latest trends in cryptocurrency?",
    "How can I improve my email marketing campaigns?",
    "What are the best practices for social media marketing?",
    "How do I create an effective content marketing strategy?",
  ],
  Product: [
    "What features should I prioritize in my product roadmap?",
    "How can I improve my product's user experience?",
    "What are the key metrics to track for product success?",
    "How do I conduct effective user research?",
  ],
  "Customer Support": [
    "How can I reduce customer response time?",
    "What are the best practices for handling customer complaints?",
    "How do I build an effective knowledge base?",
    "What tools can help automate customer support?",
  ],
  Advertising: [
    "What's the best way to optimize my ad spend?",
    "How do I create effective ad copy?",
    "What are the latest trends in digital advertising?",
    "How can I improve my ad conversion rates?",
  ],
}

interface SuggestionChipsProps {
  onPromptSelect: (prompt: string) => void
  show: boolean
}

export function SuggestionChips({ onPromptSelect, show }: SuggestionChipsProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(null)

  if (!show) return null

  const handleCategoryClick = (category: CategoryType) => {
    if (selectedCategory === category) {
      setSelectedCategory(null)
    } else {
      setSelectedCategory(category)
    }
  }

  const handlePromptClick = (prompt: string) => {
    onPromptSelect(prompt)
    setSelectedCategory(null)
  }

  return (
    <div className="max-w-4xl mx-auto  px-4">
      {/* Category Chips */}
      <div className="flex flex-wrap gap-3 justify-center mb-4">
        {Object.keys(prompts).map((category) => {
          const Icon = categoryIcons[category as keyof typeof categoryIcons]
          return (
            <Button
              key={category}
              onClick={() => handleCategoryClick(category as CategoryType)}
              variant="outline"
              className="rounded-full px-6 py-6 text-base bg-white dark:bg-bg-dark border-2 border-info-lm dark:border-info hover:bg-gray-50 dark:hover:bg-highlight flex items-center gap-2 transition-all"
            >
              <Icon className="w-5 h-5" />
              {category}
            </Button>
          )
        })}
      </div>

      {/* Prompts for Selected Category */}
      {selectedCategory && (
        <div className="bg-white dark:bg-bg-dark rounded-2xl border-2 border-info-lm dark:border-info p-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-lg font-semibold mb-3 text-text-lm dark:text-text flex items-center gap-2">
            {(() => {
              const Icon = categoryIcons[selectedCategory as keyof typeof categoryIcons]
              return <Icon className="w-5 h-5" />
            })()}
            {selectedCategory}
          </h3>
          <div className="flex flex-col gap-2">
            {prompts[selectedCategory]?.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handlePromptClick(prompt)}
                className="text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-highlight transition-colors text-text-lm dark:text-text-muted border border-transparent hover:border-info-lm dark:hover:border-info flex items-start gap-3"
              >
                <span className="text-info-lm dark:text-info mt-1">•</span>
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}




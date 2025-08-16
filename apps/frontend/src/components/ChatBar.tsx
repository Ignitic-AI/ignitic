"use client"

import { Sparkles, SendHorizonal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { TypingText } from '@/components/ui/typing-text';

export function Chatbar() {
  const [inputValue, setInputValue] = useState("")

  const handleSend = () => {
    if (inputValue.trim()) {
      console.log("Sending message:", inputValue)
      setInputValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col items-start font-generalSans w-full p-6">
      {/* Heading */}
      <h2 className="text-3xl font-bold text-text mb-4">
        What would you like to automate?
      </h2>

      {/* Chat Input Bar */}
      {/* Chat Input Bar */}
<div className="relative flex items-center w-3/4">
  {/* Left Icon */}
  <div className="absolute left-4 flex items-center pointer-events-none">
    <Sparkles className="h-5 w-5 text-blue-500" />
  </div>

  {/* TypingText as placeholder */}
  {inputValue.trim() === "" && (
    <div className="absolute left-12 text-gray-500 pointer-events-none">
      <TypingText
        texts={[
          "Welcome to our platform",
          "Build amazing projects",
          "Create beautiful designs",
          "Ship faster than ever",
        ]}
        className="text-base"
        speed={75}
        loop={true}
        pauseDuration={1100}
        showCursor={true}
        cursor="_"
        cursorClassName="font-semibold "
      />
    </div>
  )}

  {/* Input */}
  <Input
    type="text"
    className="flex-1 pl-12 pr-14 py-4 text-base border-4 border-blue-300 rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 bg-gray-300"
    value={inputValue}
    onChange={(e) => setInputValue(e.target.value)}
    onKeyDown={handleKeyDown}
  />

  {/* Send Button */}
  <Button
    variant="ghost"
    size="icon"
    className="absolute right-2 h-10 w-10 rounded-full text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    onClick={handleSend}
    disabled={!inputValue.trim()}
  >
    <SendHorizonal className="h-5 w-5" />
  </Button>
</div>

    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Paperclip, Plus, X, Bot, TrendingUp, ChevronDown, Check, Cpu, FileText,FileSpreadsheet, FileText as DocIcon, Video, Cloud, Database, MessageSquare, Globe } from 'lucide-react'
import { ModeToggle } from "@/components/ThemeToggle"

interface Agent {
  id: string
  name: string
  description: string
  avatar: string
  capabilities: string[]
  status: 'online' | 'offline' | 'busy'
}

interface Tool {
  id: string
  name: string
  description: string
  category: string
  icon: string
}

interface ChatMessage {
  id: string
  type: 'user' | 'agent'
  content: string
  timestamp: Date
  agentId?: string
  attachments?: string[]
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Marketing Automation Agent',
    description: 'Manages email campaigns, social media ads, and customer engagement',
    avatar: '📧',
    capabilities: ['Email Marketing', 'Social Media Ads', 'Customer Segmentation'],
    status: 'online'
  },
  {
    id: '2',
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries, tickets, and support automation',
    avatar: '🎧',
    capabilities: ['Ticket Management', 'FAQ Automation', 'Live Chat'],
    status: 'online'
  },
  {
    id: '3',
    name: 'SEO & Analytics Agent',
    description: 'Optimizes store performance and tracks business metrics',
    avatar: '📊',
    capabilities: ['SEO Optimization', 'Performance Tracking', 'Data Analysis'],
    status: 'busy'
  },
  {
    id: '4',
    name: 'Store Management Agent',
    description: 'Manages inventory, orders, and store operations',
    avatar: '🏪',
    capabilities: ['Inventory Management', 'Order Processing', 'Store Setup'],
    status: 'online'
  },
  {
    id: '5',
    name: 'Product Research Agent',
    description: 'Analyzes market trends, competitor products, and pricing strategies',
    avatar: '🔍',
    capabilities: ['Market Research', 'Competitor Analysis', 'Price Optimization', 'Trend Analysis'],
    status: 'online'
  }
]

const mockTools: Tool[] = [
  {
    id: '1',
    name: 'Shopify Connector',
    description: 'Connect to Shopify store for data and automation',
    category: 'eCommerce',
    icon: '🛒'
  },
  {
    id: '2',
    name: 'Email Marketing Platform',
    description: 'Integrate with Mailchimp, Klaviyo for campaigns',
    category: 'Marketing',
    icon: '📧'
  },
  {
    id: '3',
    name: 'Social Media API',
    description: 'Connect to Facebook, Instagram, Twitter APIs',
    category: 'Social Media',
    icon: '📱'
  },
  {
    id: '4',
    name: 'Google Analytics',
    description: 'Track website performance and customer behavior',
    category: 'Analytics',
    icon: '📈'
  },
  {
    id: '5',
    name: 'Customer Support Tool',
    description: 'Integrate with Zendesk, Intercom for support',
    category: 'Support',
    icon: '🎧'
  },
  {
    id: '6',
    name: 'Payment Gateway',
    description: 'Connect to Stripe, PayPal for transactions',
    category: 'Payments',
    icon: '💳'
  }
]

const llmOptions = [
  { id: 'auto', name: 'Auto', description: 'Automatically select best model' },
  { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model' },
  { id: 'gpt-3.5', name: 'GPT-3.5', description: 'Fast and efficient' },
  { id: 'claude', name: 'Claude', description: 'Anthropic Claude' },
  { id: 'gemini', name: 'Gemini', description: 'Google Gemini Pro' }
]

const integrationOptions = [
  { 
    id: 'google-sheets', 
    name: 'Google Sheets', 
    description: 'Import data from spreadsheets', 
    icon: FileSpreadsheet, 
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  { 
    id: 'google-docs', 
    name: 'Google Docs', 
    description: 'Import documents and text', 
    icon: DocIcon, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  { 
    id: 'upload-media', 
    name: 'Upload Media', 
    description: 'Images, videos, and audio files', 
    icon: Video, 
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  { 
    id: 'dropbox', 
    name: 'Dropbox', 
    description: 'Access files from Dropbox', 
    icon: Cloud, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-50'
  },
  { 
    id: 'onedrive', 
    name: 'OneDrive', 
    description: 'Microsoft OneDrive files', 
    icon: Database, 
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50'
  },
  { 
    id: 'notion', 
    name: 'Notion', 
    description: 'Import from Notion pages', 
    icon: FileText, 
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  },
  { 
    id: 'slack', 
    name: 'Slack', 
    description: 'Connect Slack channels', 
    icon: MessageSquare, 
    color: 'text-pink-600',
    bgColor: 'bg-pink-50'
  },
  { 
    id: 'url', 
    name: 'Web URL', 
    description: 'Import from web pages', 
    icon: Globe, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  }
]

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
  initialQuery?: string
}

export function ChatWindow({ isOpen, onClose, initialQuery = '' }: ChatWindowProps) {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'user',
      content: initialQuery || 'Hello! I need help with my eCommerce store automation. Can you help me set up marketing campaigns and customer support?',
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [activeTab, setActiveTab] = useState('chat')
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [showToolSelection, setShowToolSelection] = useState(false)
  const [showLLMDropdown, setShowLLMDropdown] = useState(false)
  const [showIntegrationDropdown, setShowIntegrationDropdown] = useState(false)
  const [selectedLLM, setSelectedLLM] = useState('auto')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const llmDropdownRef = useRef<HTMLDivElement>(null)
  const integrationDropdownRef = useRef<HTMLDivElement>(null)

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    setInputMessage('')

    // Simulate agent response
    setTimeout(() => {
      const agentResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: `I've processed your eCommerce request: "${inputMessage}". I can help you automate marketing campaigns, customer support, and store operations using our integrated tools.`,
        timestamp: new Date(),
        agentId: '1'
      }
      setMessages(prev => [...prev, agentResponse])
    }, 1000)
  }

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    )
  }

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    )
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAgentDropdown(false)
      }
      if (llmDropdownRef.current && !llmDropdownRef.current.contains(event.target as Node)) {
        setShowLLMDropdown(false)
      }
      if (integrationDropdownRef.current && !integrationDropdownRef.current.contains(event.target as Node)) {
        setShowIntegrationDropdown(false)
      }
    }

    if (showAgentDropdown || showLLMDropdown || showIntegrationDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAgentDropdown, showLLMDropdown, showIntegrationDropdown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors mr-2"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">IgniticAI eCommerce Super-Agent</h2>
            <p className="text-sm text-slate-600">
              Intelligent automation for marketing, support, SEO, and store management
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Chat History */}
        <div className="w-80 border-r border-slate-200 bg-slate-50 p-4">
          <div className="mb-6">
            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 justify-center shadow-md hover:shadow-lg">
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>
          
          <div className="space-y-2">
            {['Marketing Campaign Setup', 'Customer Support Automation', 'SEO Performance Review', 'Inventory Management', 'Social Media Strategy', 'Ad Campaign Analysis'].map((chat, index) => (
              <div key={index} className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-all duration-200 hover:shadow-md">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">{chat}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Last active: {index + 1} hour ago</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area - Chat Interface */}
        <div className="flex-1 flex flex-col">
          {/* Chat Interface */}
          <div className="flex-1 flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-50 to-white">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {message.type === 'agent' && (
                        <span className="text-sm opacity-75">
                          {mockAgents.find(a => a.id === message.agentId)?.name}
                        </span>
                      )}
                      <span className="text-xs opacity-75">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-6 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                {/* Integration Dropdown */}
                <div className="relative" ref={integrationDropdownRef}>
                  <button
                    onClick={() => setShowIntegrationDropdown(!showIntegrationDropdown)}
                    className="p-3 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <Paperclip className="w-5 h-5 text-slate-500" />
                  </button>
                  
                  {showIntegrationDropdown && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                      <div className="p-3 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-800">Integrations</h3>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {integrationOptions.map((option) => {
                          const IconComponent = option.icon
                          return (
                            <div
                              key={option.id}
                              className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                              onClick={() => {
                                console.log(`Selected integration: ${option.name}`)
                                setShowIntegrationDropdown(false)
                              }}
                            >
                              <div className={`w-8 h-8 ${option.bgColor} rounded-lg flex items-center justify-center`}>
                                <IconComponent className={`w-4 h-4 ${option.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-slate-800">{option.name}</h4>
                                <p className="text-xs text-slate-500">{option.description}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask about eCommerce automation, marketing campaigns, customer support..."
                    className="w-full pl-4 pr-4 py-4 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-all duration-200"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {/* LLM Selector */}
                  <div className="relative" ref={llmDropdownRef}>
                    <button
                      onClick={() => setShowLLMDropdown(!showLLMDropdown)}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Cpu className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">
                        {llmOptions.find(llm => llm.id === selectedLLM)?.name || 'Auto'}
                      </span>
                      <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${showLLMDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showLLMDropdown && (
                      <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                        {llmOptions.map((llm) => (
                          <div
                            key={llm.id}
                            className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                            onClick={() => {
                              setSelectedLLM(llm.id)
                              setShowLLMDropdown(false)
                            }}
                          >
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                              <Cpu className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-slate-800">{llm.name}</h4>
                              <p className="text-xs text-slate-600">{llm.description}</p>
                            </div>
                            {selectedLLM === llm.id && (
                              <Check className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white p-3 rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <span className="text-sm font-medium">IgniticAI</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Compact Agent Selection & Analytics */}
        <div className="w-80 border-l border-slate-200 bg-white p-4 overflow-y-auto">
          {/* Analytics Section - Top */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide text-green-600">Analytics</h3>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-700">Revenue</span>
                    <p className="text-xs text-slate-500">Last 30 days</p>
                  </div>
                </div>
                <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full font-semibold">+12.5%</span>
              </div>
              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-slate-800 mb-1">$24,580</div>
                <div className="text-xs text-slate-600">vs $21,850 last month</div>
              </div>
              {/* Mini Chart */}
              <div className="h-12 flex items-end justify-center gap-1">
                {[20, 35, 28, 45, 38, 52, 48, 65, 58, 72, 68, 85].map((height, index) => (
                  <div
                    key={index}
                    className="w-1.5 bg-gradient-to-t from-green-400 to-green-600 rounded-full"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Compact Agent Selector */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide text-blue-600">Select Agent</h3>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {selectedAgents.length > 0 
                      ? `${selectedAgents.length} agent${selectedAgents.length > 1 ? 's' : ''} selected`
                      : 'Choose an agent'
                    }
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showAgentDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showAgentDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {mockAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      onClick={() => toggleAgent(agent.id)}
                    >
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                        {agent.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-800 truncate">{agent.name}</h4>
                          <div className={`w-2 h-2 rounded-full ${
                            agent.status === 'online' ? 'bg-green-500' : 
                            agent.status === 'busy' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                        </div>
                        <p className="text-xs text-slate-600 truncate">{agent.description}</p>
                      </div>
                      {selectedAgents.includes(agent.id) && (
                        <Check className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Agents Results */}
          {selectedAgents.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide text-purple-600">Agent Results</h3>
              <div className="space-y-3">
                {selectedAgents.map((agentId) => {
                  const agent = mockAgents.find(a => a.id === agentId)
                  if (!agent) return null
                  
                  return (
                    <div key={agentId} className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-lg">
                          {agent.avatar}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800">{agent.name}</h4>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              agent.status === 'online' ? 'bg-green-500' : 
                              agent.status === 'busy' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-xs text-slate-500 capitalize">{agent.status}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Agent-specific results */}
                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">
                          <strong>Active Tasks:</strong> {Math.floor(Math.random() * 5) + 1}
                        </div>
                        <div className="text-xs text-slate-600">
                          <strong>Success Rate:</strong> {Math.floor(Math.random() * 30) + 70}%
                        </div>
                        <div className="text-xs text-slate-600">
                          <strong>Last Activity:</strong> {Math.floor(Math.random() * 60) + 1} min ago
                        </div>
                      </div>
                      
                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {agent.capabilities.slice(0, 2).map((capability, index) => (
                          <span key={index} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            {capability}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Available Tools - Only show when agents are selected */}
          {selectedAgents.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide text-orange-600">Available Tools</h3>
              <div className="space-y-2">
                {mockTools.slice(0, 4).map((tool) => (
                  <div key={tool.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-pink-100 rounded-lg flex items-center justify-center text-sm">
                        {tool.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-800 truncate">{tool.name}</h4>
                        <p className="text-xs text-slate-600 truncate">{tool.description}</p>
                        <span className="inline-block mt-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          {tool.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market Results - Compact */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide text-indigo-600">Market Results</h3>
            <div className="space-y-2">
              {[
                {
                  platform: 'Amazon',
                  name: 'Sony WH-1000XM4',
                  rating: '4.6',
                  price: '$278.00',
                  image: '🎧'
                },
                {
                  platform: 'eBay',
                  name: 'iPhone 13 Pro Case',
                  rating: '4.8',
                  price: '$24.99',
                  image: '📱'
                }
              ].map((product, index) => (
                <div key={index} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center text-lg">
                      {product.image}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-500">{product.platform}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500 text-xs">⭐</span>
                          <span className="text-xs font-semibold text-slate-700">{product.rating}</span>
                        </div>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800 truncate">{product.name}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-slate-800">{product.price}</span>
                        <button className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded-full transition-colors">
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

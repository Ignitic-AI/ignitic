'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, PieChart, Network, BarChart } from "lucide-react"

export function ChartsSection() {
  return (
    <div className="space-y-4">
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            ANALYTICS CHARTS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {/* Line Chart */}
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-700 group-hover:text-blue-700 transition-colors">Revenue</h4>
                <TrendingUp className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="h-16 bg-white rounded-lg border border-blue-200 flex items-center justify-center group-hover:border-blue-300 group-hover:shadow-inner transition-all duration-300">
                <div className="text-center">
                  <div className="w-12 h-6 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-sm mb-1 group-hover:from-blue-500 group-hover:to-indigo-600 transition-all duration-300"></div>
                  <div className="w-8 h-4 bg-gradient-to-r from-blue-300 to-indigo-400 rounded-sm mb-1 group-hover:from-blue-400 group-hover:to-indigo-500 transition-all duration-300"></div>
                  <div className="w-10 h-5 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-sm group-hover:from-blue-500 group-hover:to-indigo-600 transition-all duration-300"></div>
                </div>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-700 group-hover:text-green-700 transition-colors">Traffic</h4>
                <PieChart className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="h-16 bg-white rounded-lg border border-green-200 flex items-center justify-center group-hover:border-green-300 group-hover:shadow-inner transition-all duration-300">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full group-hover:from-green-500 group-hover:to-emerald-600 transition-all duration-300"></div>
                  <div className="absolute inset-1.5 bg-white rounded-full"></div>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-green-400 group-hover:bg-green-500 transition-all duration-300"></div>
                </div>
              </div>
            </div>

            {/* Network/Flow Chart */}
            <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-700 group-hover:text-purple-700 transition-colors">Flow</h4>
                <Network className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="h-16 bg-white rounded-lg border border-purple-200 flex items-center justify-center group-hover:border-purple-300 group-hover:shadow-inner transition-all duration-300">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-purple-400 rounded-full group-hover:bg-purple-500 group-hover:scale-110 transition-all duration-300"></div>
                  <div className="w-1 h-0.5 bg-purple-300 group-hover:bg-purple-400 transition-all duration-300"></div>
                  <div className="w-4 h-4 bg-purple-400 rounded-full group-hover:bg-purple-500 group-hover:scale-110 transition-all duration-300"></div>
                  <div className="w-1 h-0.5 bg-purple-300 group-hover:bg-purple-400 transition-all duration-300"></div>
                  <div className="w-4 h-4 bg-purple-400 rounded-full group-hover:bg-purple-500 group-hover:scale-110 transition-all duration-300"></div>
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-100 hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-700 group-hover:text-orange-700 transition-colors">Sales</h4>
                <BarChart className="w-4 h-4 text-orange-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="h-16 bg-white rounded-lg border border-orange-200 flex items-center justify-center group-hover:border-orange-300 group-hover:shadow-inner transition-all duration-300">
                <div className="flex items-end gap-1 h-8">
                  <div className="w-2 bg-orange-400 rounded-t-sm group-hover:bg-orange-500 group-hover:h-9 transition-all duration-300" style={{height: '60%'}}></div>
                  <div className="w-2 bg-orange-500 rounded-t-sm group-hover:bg-orange-600 group-hover:h-10 transition-all duration-300" style={{height: '80%'}}></div>
                  <div className="w-2 bg-orange-400 rounded-t-sm group-hover:bg-orange-500 group-hover:h-8 transition-all duration-300" style={{height: '40%'}}></div>
                  <div className="w-2 bg-orange-500 rounded-t-sm group-hover:bg-orange-600 group-hover:h-11 transition-all duration-300" style={{height: '90%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            QUICK INSIGHTS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md transition-all duration-300 cursor-pointer group">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600 group-hover:text-green-700 group-hover:scale-110 transition-all duration-300">+2.4%</div>
                <div className="text-xs text-slate-600 group-hover:text-slate-700 transition-colors">Conversion Rate</div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md transition-all duration-300 cursor-pointer group">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600 group-hover:text-blue-700 group-hover:scale-110 transition-all duration-300">1.2s</div>
                <div className="text-xs text-slate-600 group-hover:text-slate-700 transition-colors">Avg. Response</div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md transition-all duration-300 cursor-pointer group">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600 group-hover:text-purple-700 group-hover:scale-110 transition-all duration-300">94.2%</div>
                <div className="text-xs text-slate-600 group-hover:text-slate-700 transition-colors">Success Rate</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

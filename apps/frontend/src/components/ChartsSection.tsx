'use client'

export function ChartsSection() {
  return (
    <div className="space-y-2">
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-slate-300">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Analytics Charts</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {/* Line Chart */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Revenue</h4>
              <svg className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center group-hover:border-slate-300 transition-colors duration-200">
              <div className="text-center">
                <div className="w-12 h-6 bg-blue-400 rounded-sm mb-1"></div>
                <div className="w-8 h-4 bg-blue-300 rounded-sm mb-1"></div>
                <div className="w-10 h-5 bg-blue-400 rounded-sm"></div>
              </div>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Traffic</h4>
              <svg className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
            </div>
            <div className="h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center group-hover:border-slate-300 transition-colors duration-200">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 bg-green-400 rounded-full"></div>
                <div className="absolute inset-1.5 bg-white rounded-full"></div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-green-400"></div>
              </div>
            </div>
          </div>

          {/* Network/Flow Chart */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Flow</h4>
              <svg className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <div className="h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center group-hover:border-slate-300 transition-colors duration-200">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
                <div className="w-1 h-0.5 bg-purple-300"></div>
                <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
                <div className="w-1 h-0.5 bg-purple-300"></div>
                <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Sales</h4>
              <svg className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center group-hover:border-slate-300 transition-colors duration-200">
              <div className="flex items-end gap-1 h-8">
                <div className="w-2 bg-orange-400 rounded-t-sm" style={{height: '60%'}}></div>
                <div className="w-2 bg-orange-500 rounded-t-sm" style={{height: '80%'}}></div>
                <div className="w-2 bg-orange-400 rounded-t-sm" style={{height: '40%'}}></div>
                <div className="w-2 bg-orange-500 rounded-t-sm" style={{height: '90%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-slate-300">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Quick Insights</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
            <div className="text-center">
              <div className="text-xl font-semibold text-green-600 mb-1 group-hover:scale-110 transition-transform duration-200">+2.4%</div>
              <div className="text-sm text-slate-600">Conversion Rate</div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
            <div className="text-center">
              <div className="text-xl font-semibold text-blue-600 mb-1 group-hover:scale-110 transition-transform duration-200">1.2s</div>
              <div className="text-sm text-slate-600">Avg. Response</div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
            <div className="text-center">
              <div className="text-xl font-semibold text-purple-600 mb-1 group-hover:scale-110 transition-transform duration-200">94.2%</div>
              <div className="text-sm text-slate-600">Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

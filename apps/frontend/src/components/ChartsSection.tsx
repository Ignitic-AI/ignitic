'use client'

export function ChartsSection() {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="dark:bg-bg bg-bg-lm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-text-lm dark:text-text">Quick Insights</h3>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="p-4 dark:bg-bg-light bg-bg-light-lm rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all duration-200 cursor-pointer group">
            <div className="text-center">
              <div className="text-xl font-semibold text-green-600 mb-1 group-hover:scale-110 transition-transform duration-200">+2.4%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Conversion Rate</div>
            </div>
          </div>
          <div className="p-4 dark:bg-bg-light bg-bg-light-lm rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all duration-200 cursor-pointer group">
            <div className="text-center">
              <div className="text-xl font-semibold text-blue-600 mb-1 group-hover:scale-110 transition-transform duration-200">1.2s</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Avg. Response</div>
            </div>
          </div>
          <div className="p-4 dark:bg-bg-light bg-bg-light-lm rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all duration-200 cursor-pointer group">
            <div className="text-center">
              <div className="text-xl font-semibold text-purple-600 mb-1 group-hover:scale-110 transition-transform duration-200">94.2%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Success Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

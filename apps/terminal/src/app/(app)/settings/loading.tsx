export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-pulse">
      <div className="w-32 h-8 rounded-xl bg-gray-200 dark:bg-white/10" />
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10">
            <div className="w-32 h-4 rounded-lg bg-gray-200 dark:bg-white/10" />
          </div>
          <div className="p-6 space-y-3">
            <div className="w-full h-10 rounded-xl bg-gray-100 dark:bg-white/5" />
            <div className="w-full h-10 rounded-xl bg-gray-100 dark:bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
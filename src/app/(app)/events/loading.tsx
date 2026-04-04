export default function EventsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="w-32 h-8 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="w-36 h-10 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden animate-pulse">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/10" />
          <div className="w-36 h-5 rounded-lg bg-gray-200 dark:bg-white/10" />
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-white/10" />
        </div>
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-white/10">
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="h-8 bg-gray-50 dark:bg-white/[0.02]" />
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-20 border-b border-r border-gray-50 dark:border-white/5 p-1.5">
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
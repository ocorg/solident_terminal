export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-white/10" />
        <div className="w-16 h-5 rounded-full bg-gray-200 dark:bg-white/10" />
      </div>
      <div className="w-3/4 h-4 rounded-lg bg-gray-200 dark:bg-white/10 mb-2" />
      <div className="w-1/2 h-3 rounded-lg bg-gray-100 dark:bg-white/5 mb-4" />
      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10" />
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl animate-pulse">
      <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0" />
      <div className="flex-1 h-4 rounded-lg bg-gray-200 dark:bg-white/10" />
      <div className="w-20 h-4 rounded-lg bg-gray-100 dark:bg-white/5 hidden sm:block" />
      <div className="w-16 h-6 rounded-lg bg-gray-200 dark:bg-white/10 flex-shrink-0" />
    </div>
  )
}

export function SkeletonWidget() {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 animate-pulse">
      <div className="w-32 h-4 rounded-lg bg-gray-200 dark:bg-white/10 mb-4" />
      <div className="space-y-3">
        <div className="w-full h-12 rounded-xl bg-gray-100 dark:bg-white/5" />
        <div className="w-full h-12 rounded-xl bg-gray-100 dark:bg-white/5" />
        <div className="w-3/4 h-12 rounded-xl bg-gray-100 dark:bg-white/5" />
      </div>
    </div>
  )
}

export function SkeletonBanner() {
  return (
    <div className="bg-gradient-to-r from-gray-200 to-gray-100 dark:from-white/10 dark:to-white/5 rounded-2xl p-6 animate-pulse">
      <div className="w-24 h-3 rounded-lg bg-gray-300 dark:bg-white/10 mb-2" />
      <div className="w-48 h-7 rounded-lg bg-gray-300 dark:bg-white/10 mb-1" />
      <div className="w-32 h-3 rounded-lg bg-gray-200 dark:bg-white/5" />
    </div>
  )
}

export function SkeletonDetailPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
      <div className="w-32 h-4 rounded-lg bg-gray-200 dark:bg-white/10" />
      <div className="w-64 h-8 rounded-xl bg-gray-200 dark:bg-white/10" />
      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/5" />
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex-1 h-9 rounded-lg bg-gray-100 dark:bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-white/5" />
        ))}
      </div>
    </div>
  )
}
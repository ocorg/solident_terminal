import { SkeletonRow } from '@/components/Skeleton'

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="w-32 h-8 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="w-36 h-10 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-10 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1,2,3,4].map(col => (
          <div key={col} className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-3 space-y-2">
            <div className="w-24 h-4 rounded-lg bg-gray-200 dark:bg-white/10 animate-pulse mb-3" />
            {[1,2,3].map(i => <SkeletonRow key={i} />)}
          </div>
        ))}
      </div>
    </div>
  )
}
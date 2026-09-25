import { SkeletonCard } from '@/components/Skeleton'

export default function MembersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="w-28 h-8 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="w-40 h-10 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-10 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}
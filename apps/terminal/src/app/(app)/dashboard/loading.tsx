import { SkeletonBanner, SkeletonWidget } from '@/components/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonBanner />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {[1,2,3,4,5].map(i => <SkeletonWidget key={i} />)}
      </div>
    </div>
  )
}
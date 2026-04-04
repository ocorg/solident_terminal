import { SkeletonRow } from '@/components/Skeleton'

export default function ProposalsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="w-36 h-8 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="w-44 h-10 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-10 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      </div>
      <div className="space-y-3">
        {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}
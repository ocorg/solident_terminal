export default function TasksLoading() {
  const CardSkeleton = () => (
    <div className="bg-white dark:bg-[#161B22] rounded-xl p-3 relative overflow-hidden"
      style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.04), 0 4px 6px -2px rgba(0,0,0,0.02)' }}>
      {/* Priority strip */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl shimmer" />
      <div className="pl-2 space-y-2">
        {/* Title */}
        <div className="h-4 w-3/4 rounded-lg shimmer" />
        <div className="h-3 w-1/2 rounded-lg shimmer" />
        {/* Date */}
        <div className="h-3 w-24 rounded-lg shimmer mt-1" />
        {/* Stacked avatars */}
        <div className="flex mt-2" style={{ gap: '-4px' }}>
          {[0,1].map(i => (
            <div key={i} className="w-6 h-6 rounded-full shimmer border-2 border-white dark:border-[#161B22]"
              style={{ marginLeft: i > 0 ? '-6px' : '0' }} />
          ))}
        </div>
      </div>
    </div>
  )

  const ColSkeleton = ({ accent }: { accent: string }) => (
    <div className="bg-[#F8FAFC] dark:bg-[#161B22] rounded-2xl p-3 min-h-[300px]"
      style={{ borderTop: `4px solid ${accent}` }}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="h-3 w-20 rounded-lg shimmer" />
        <div className="h-4 w-6 rounded-full shimmer" />
      </div>
      <div className="space-y-2">
        {[1,2,3].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header row skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-24 rounded-xl shimmer" />
          <div className="h-4 w-32 rounded-lg shimmer" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-xl shimmer" />
          <div className="h-9 w-32 rounded-xl shimmer" />
          <div className="h-9 w-36 rounded-xl shimmer" />
        </div>
      </div>
      {/* Search + filter row */}
      <div className="flex gap-3">
        <div className="flex-1 h-10 rounded-xl shimmer" />
        <div className="flex gap-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 w-20 rounded-xl shimmer" />)}
        </div>
      </div>
      {/* Kanban columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ColSkeleton accent="#94a3b8" />
        <ColSkeleton accent="#1E5F7A" />
        <ColSkeleton accent="#f87171" />
        <ColSkeleton accent="#4ade80" />
      </div>
    </div>
  )
}
export default function WeeklyLoading() {
  return (
    <div className="animate-pulse">
      {/* Week nav skeleton */}
      <div className="flex items-center justify-between pt-8 pb-6">
        <div className="skeleton h-5 w-20" />
        <div className="skeleton h-7 w-36" />
        <div className="skeleton h-5 w-16" />
      </div>

      {/* Date range */}
      <div className="flex justify-center mb-8">
        <div className="skeleton h-4 w-48" />
      </div>

      {/* Week over week card */}
      <div className="rounded-xl border border-border bg-card p-5 mb-10">
        <div className="skeleton h-4 w-32 mb-3" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-4/5" />
        </div>
      </div>

      {/* Theme cards */}
      <div className="skeleton h-5 w-28 mb-5" />
      <div className="h-px bg-border mb-5" />
      <div className="space-y-4 mb-10">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="skeleton h-5 w-2/3 mb-3" />
            <div className="skeleton h-3 w-24 mb-3" />
            <div className="space-y-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
            </div>
          </div>
        ))}
      </div>

      {/* Source highlights */}
      <div className="skeleton h-5 w-36 mb-5" />
      <div className="h-px bg-border mb-5" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="skeleton h-4 w-24 mb-3" />
            <div className="space-y-1.5">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-4/5" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DigestLoading() {
  return (
    <div className="animate-pulse">
      {/* Day nav skeleton */}
      <div className="flex items-center justify-between pt-8 pb-6">
        <div className="skeleton h-5 w-20" />
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-5 w-16" />
      </div>

      {/* Section skeletons */}
      {[1, 2, 3, 4].map((section) => (
        <div key={section} className="mb-10">
          {/* Section header */}
          <div className="flex items-center gap-2.5 mb-5 pt-10 first:pt-0">
            <div className="skeleton h-5 w-5 rounded-full" />
            <div className="skeleton h-5 w-32" />
          </div>
          <div className="h-px bg-border mb-5" />

          {/* Cards */}
          <div className="space-y-4">
            {[1, 2].map((card) => (
              <div key={card} className="rounded-xl border border-border bg-card p-5">
                <div className="skeleton h-5 w-3/4 mb-3" />
                <div className="skeleton h-3 w-24 mb-3" />
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

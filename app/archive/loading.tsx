export default function ArchiveLoading() {
  return (
    <div className="animate-pulse pt-8 pb-16">
      <div className="skeleton h-7 w-24 mb-8" />
      <div className="grid grid-cols-2 gap-10">
        {[1, 2].map((col) => (
          <div key={col}>
            <div className="skeleton h-4 w-28 mb-4" />
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="skeleton h-11 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

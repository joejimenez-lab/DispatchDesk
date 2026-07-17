function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[2px] bg-[#d7d4ca] ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#6757e8]" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <span>Loading workspace</span>
          </div>
          <SkeletonBlock className="h-7 w-48" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        <SkeletonBlock className="h-10 w-28" />
      </div>

      <section className="metric-ledger">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="metric-cell">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="mt-3 h-8 w-32" />
          </div>
        ))}
      </section>

      <section className="dispatch-panel p-5">
        <SkeletonBlock className="h-5 w-36" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-12 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}

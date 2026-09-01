function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 ${className}`} />;
}

export function TablePageLoading({ label }: { label: string }) {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">Loading {label.toLowerCase()}</span>
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Bar className="h-7 w-40" /><Bar className="h-4 w-72" /></div>
        <Bar className="h-10 w-28" />
      </div>
      <Bar className="h-24 w-full" />
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <Bar className="h-8 w-full" />
        {Array.from({ length: 8 }).map((_, index) => <Bar key={index} className="mt-3 h-12 w-full" />)}
      </div>
    </div>
  );
}

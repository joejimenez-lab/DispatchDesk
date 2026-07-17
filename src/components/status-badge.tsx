import { cn } from "@/lib/utils";
import type { LoadStatus } from "@/types/database";

const tones: Partial<Record<LoadStatus, string>> = {
  Booked: "bg-sky-50 text-sky-700 ring-sky-200",
  Dispatched: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Picked Up": "bg-violet-50 text-violet-700 ring-violet-200",
  "In Transit": "bg-amber-50 text-amber-800 ring-amber-200",
  Delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Closed: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  Cancelled: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: LoadStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-[12px] font-semibold tracking-[0.01em] ring-1 ring-inset", tones[status])}>
      <span className="mr-1.5 size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {status}
    </span>
  );
}

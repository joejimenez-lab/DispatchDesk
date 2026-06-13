import { cn } from "@/lib/utils";
import type { LoadStatus } from "@/types/database";

const tones: Partial<Record<LoadStatus, string>> = {
  Booked: "bg-sky-50 text-sky-700 ring-sky-200",
  Dispatched: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Picked Up": "bg-violet-50 text-violet-700 ring-violet-200",
  "In Transit": "bg-amber-50 text-amber-800 ring-amber-200",
  Delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "POD Received": "bg-teal-50 text-teal-700 ring-teal-200",
  Invoiced: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "Client Paid": "bg-green-50 text-green-700 ring-green-200",
  "Driver Paid": "bg-lime-50 text-lime-700 ring-lime-200",
  "Dispatcher Paid": "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  Closed: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  Cancelled: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: LoadStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", tones[status])}>
      {status}
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLoadStatus } from "@/lib/actions/loads";
import { cn } from "@/lib/utils";
import { loadStatuses, type LoadStatus } from "@/types/database";

const tones: Record<LoadStatus, string> = {
  Booked: "border-sky-200 bg-sky-50 text-sky-700",
  Dispatched: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Picked Up": "border-violet-200 bg-violet-50 text-violet-700",
  "In Transit": "border-amber-200 bg-amber-50 text-amber-800",
  Delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Closed: "border-zinc-300 bg-zinc-100 text-zinc-700",
  Cancelled: "border-red-200 bg-red-50 text-red-700",
};

export function LoadStatusSelect({ loadId, status }: { loadId: string; status: LoadStatus }) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [isPending, startTransition] = useTransition();

  function changeStatus(nextStatus: LoadStatus) {
    const previousStatus = selectedStatus;
    setSelectedStatus(nextStatus);

    startTransition(async () => {
      const result = await updateLoadStatus(loadId, nextStatus);
      if (result.status === "error") {
        setSelectedStatus(previousStatus);
        return;
      }

      router.refresh();
    });
  }

  return (
    <select
      aria-label="Update load status"
      value={selectedStatus}
      disabled={isPending}
      onChange={(event) => changeStatus(event.target.value as LoadStatus)}
      className={cn(
        "h-9 rounded-xl border px-3 text-[12px] font-semibold tracking-[0.01em] outline-none transition focus:ring-2 focus:ring-[#6757e8]/25 disabled:cursor-wait disabled:opacity-70",
        tones[selectedStatus],
      )}
    >
      {loadStatuses.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

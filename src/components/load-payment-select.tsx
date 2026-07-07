"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentFlag } from "@/lib/actions/loads";
import { cn } from "@/lib/utils";

export function LoadPaymentSelect({ loadId, paid }: { loadId: string; paid: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState(paid ? "paid" : "unpaid");
  const [isPending, startTransition] = useTransition();

  function changePayment(nextValue: string) {
    const previous = selected;
    setSelected(nextValue);

    startTransition(async () => {
      const result = await updatePaymentFlag(loadId, "client_paid", nextValue === "paid");
      if (result.status === "error") {
        setSelected(previous);
        return;
      }

      router.refresh();
    });
  }

  const isPaid = selected === "paid";

  return (
    <select
      aria-label="Update client payment"
      value={selected}
      disabled={isPending}
      onChange={(event) => changePayment(event.target.value)}
      className={cn(
        "h-8 w-24 rounded-full border px-3 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-zinc-200 disabled:cursor-wait disabled:opacity-70",
        isPaid
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <option value="unpaid">Unpaid</option>
      <option value="paid">Paid</option>
    </select>
  );
}

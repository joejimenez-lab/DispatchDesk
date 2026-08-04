"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function StatusRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="status-refresh"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={pending ? "status-refresh-icon status-refresh-icon-active" : "status-refresh-icon"} aria-hidden="true" />
      <span>{pending ? "Refreshing" : "Refresh"}</span>
    </button>
  );
}

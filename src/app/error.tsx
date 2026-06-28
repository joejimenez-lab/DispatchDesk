"use client";

import { FallbackPanel } from "@/components/fallback-panel";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <FallbackPanel
      title="DispatchDesk could not finish loading"
      message="Something failed before the main workspace loaded. Try again, or use the reference value when checking server logs."
      digest={error.digest}
      retry={unstable_retry}
      showBack={false}
    />
  );
}

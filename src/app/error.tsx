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
      title="Something went wrong"
      message="This page could not load. Try again. If the problem continues, share the reference number below with support."
      digest={error.digest}
      retry={unstable_retry}
      showBack={false}
    />
  );
}

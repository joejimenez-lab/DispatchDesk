"use client";

import "./globals.css";
import { FallbackPanel } from "@/components/fallback-panel";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-100 text-zinc-950">
        <title>Application error | DispatchDesk</title>
        <FallbackPanel
          title="Something went wrong"
          message="DispatchDesk could not load. Try again. If the problem continues, share the reference number below with support."
          digest={error.digest}
          retry={unstable_retry}
          showBack={false}
        />
      </body>
    </html>
  );
}

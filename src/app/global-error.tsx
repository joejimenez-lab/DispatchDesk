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
          title="DispatchDesk hit an application error"
          message="The app shell could not recover from this failure. Try again, and use the reference value when matching the failure to server logs."
          digest={error.digest}
          retry={unstable_retry}
          showBack={false}
        />
      </body>
    </html>
  );
}

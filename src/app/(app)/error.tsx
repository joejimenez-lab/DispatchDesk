"use client";

import { Button } from "@/components/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-zinc-950">Something went wrong</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">
        The app could not load this view. Try again, and if it keeps happening check the server logs for the matching error.
      </p>
      <Button type="button" className="mt-5" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

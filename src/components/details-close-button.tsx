"use client";

import { Button } from "@/components/button";

export function DetailsCloseButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
    >
      Cancel
    </Button>
  );
}

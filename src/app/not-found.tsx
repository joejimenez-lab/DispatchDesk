import type { Metadata } from "next";
import { FallbackPanel } from "@/components/fallback-panel";

export const metadata: Metadata = {
  title: "Page not found | DispatchDesk",
};

export default function NotFound() {
  return (
    <FallbackPanel
      tone="not-found"
      title="We could not find that DispatchDesk page"
      message="The route may have changed, or the record may no longer be available. Use the main dispatch areas below to get back to work."
    />
  );
}

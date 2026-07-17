import type { Metadata } from "next";
import { FallbackPanel } from "@/components/fallback-panel";

export const metadata: Metadata = {
  title: "Page not found | DispatchDesk",
};

export default function NotFound() {
  return (
    <FallbackPanel
      tone="not-found"
      title="Page not found"
      message="The link may be out of date, or the record may have been deleted. Choose a page below to continue."
    />
  );
}

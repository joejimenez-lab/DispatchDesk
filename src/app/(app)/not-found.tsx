import { FallbackPanel } from "@/components/fallback-panel";

export default function AppNotFound() {
  return (
    <FallbackPanel
      tone="not-found"
      title="Page or record not found"
      message="The link may be unavailable, restricted, or out of date. Return to the dashboard, loads, or reports to continue."
    />
  );
}

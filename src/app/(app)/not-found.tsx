import { FallbackPanel } from "@/components/fallback-panel";

export default function AppNotFound() {
  return (
    <FallbackPanel
      tone="not-found"
      title="That DispatchDesk record was not found"
      message="The page exists, but the requested record is missing or has been removed. Return to the dashboard, loads, reports, or the previous list and choose another record."
    />
  );
}

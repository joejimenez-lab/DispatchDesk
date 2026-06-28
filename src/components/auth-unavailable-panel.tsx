"use client";

import { FallbackPanel } from "@/components/fallback-panel";

export function AuthUnavailablePanel() {
  return (
    <FallbackPanel
      title="Authentication is temporarily unavailable"
      message="DispatchDesk could not verify your session. Try again once the authentication service is reachable."
      retry={() => window.location.reload()}
      showBack={false}
    />
  );
}

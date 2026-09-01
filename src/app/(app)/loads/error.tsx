"use client";

import { FallbackPanel } from "@/components/fallback-panel";

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <FallbackPanel title="Loads could not be retrieved" message="Try the filtered request again." digest={error.digest} retry={unstable_retry} showBack={false} />;
}

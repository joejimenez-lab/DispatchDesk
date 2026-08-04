import "server-only";

import { notFound, redirect } from "next/navigation";
import { logInfo } from "@/lib/logger";
import { isStatusViewerAllowed } from "@/lib/status/access-policy";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser, logAuthUnavailable } from "@/lib/supabase/auth-state";

export async function requireStatusViewer() {
  const supabase = await createClient();
  const auth = await getVerifiedUser(supabase);

  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "unavailable") {
    logAuthUnavailable(auth, { route: "/status", kind: "page" });
    throw new Error("Authentication service unavailable.");
  }

  if (!isStatusViewerAllowed(auth.user)) notFound();

  logInfo("status.viewed", { authorized: true });
  return { supabase, user: auth.user };
}

import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getSupabaseConfig,
  getVerifiedUser,
  logAuthUnavailable,
  missingSupabaseConfigResult,
} from "@/lib/supabase/auth-state";

export async function createAuthenticatedClient() {
  if (!getSupabaseConfig()) {
    const result = missingSupabaseConfigResult();
    logAuthUnavailable(result, { route: "createAuthenticatedClient", kind: "page" });
    throw new Error("Authentication service unavailable.");
  }

  const supabase = await createClient();
  const auth = await getVerifiedUser(supabase);

  if (auth.status === "unauthenticated") {
    throw new Error("Authentication required.");
  }

  if (auth.status === "unavailable") {
    logAuthUnavailable(auth, { route: "createAuthenticatedClient", kind: "page" });
    throw new Error("Authentication service unavailable.");
  }

  return { supabase, user: auth.user };
}

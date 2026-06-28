import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getVerifiedUser,
  logAuthUnavailable,
  missingSupabaseConfigResult,
  getSupabaseConfig,
  type AuthRequestContext,
} from "@/lib/supabase/auth-state";

export async function createAuthenticatedRouteClient(context: AuthRequestContext) {
  if (!getSupabaseConfig()) {
    const result = missingSupabaseConfigResult();
    logAuthUnavailable(result, context);
    return {
      response: NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 }),
    };
  }

  const supabase = await createClient();
  const auth = await getVerifiedUser(supabase);

  if (auth.status === "authenticated") {
    return { supabase, user: auth.user };
  }

  if (auth.status === "unauthenticated") {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  logAuthUnavailable(auth, context);

  return {
    response: NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 }),
  };
}

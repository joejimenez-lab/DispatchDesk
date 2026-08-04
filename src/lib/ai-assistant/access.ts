import "server-only";

import type { User } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import {
  getSupabaseConfig,
  getVerifiedUser,
  logAuthUnavailable,
  missingSupabaseConfigResult,
} from "@/lib/supabase/auth-state";
import { createClient } from "@/lib/supabase/server";

function allowedValues(value: string | undefined, normalize: (entry: string) => string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => normalize(entry.trim()))
      .filter(Boolean),
  );
}

type AssistantAccessClient = Awaited<ReturnType<typeof createClient>>;

function isAiAssistantBetaAllowlisted(user: Pick<User, "id" | "email">) {
  if (process.env.AI_ASSISTANT_ENABLED !== "true") return false;

  const allowedUserIds = allowedValues(process.env.AI_ASSISTANT_ALLOWED_USER_IDS, (entry) => entry);
  const allowedEmails = allowedValues(process.env.AI_ASSISTANT_ALLOWED_EMAILS, (entry) => entry.toLowerCase());
  if (allowedUserIds.size === 0 && allowedEmails.size === 0) return false;

  return allowedUserIds.has(user.id) || Boolean(user.email && allowedEmails.has(user.email.toLowerCase()));
}

export async function isAiAssistantUserAllowed(
  supabase: AssistantAccessClient,
  user: Pick<User, "id" | "email">,
) {
  if (!isAiAssistantBetaAllowlisted(user)) return false;

  try {
    const { data, error } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    return !error && data?.role === "owner";
  } catch {
    return false;
  }
}

export async function requireAiAssistantPageAccess() {
  if (!getSupabaseConfig()) {
    const result = missingSupabaseConfigResult();
    logAuthUnavailable(result, { route: "/AI_Assistant", kind: "page" });
    notFound();
  }

  const supabase = await createClient();
  const auth = await getVerifiedUser(supabase);
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "unavailable") {
    logAuthUnavailable(auth, { route: "/AI_Assistant", kind: "page" });
    notFound();
  }
  if (!await isAiAssistantUserAllowed(supabase, auth.user)) notFound();

  return { supabase, user: auth.user };
}

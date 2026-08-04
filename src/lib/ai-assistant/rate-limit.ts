import "server-only";

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AssistantRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class AssistantRateLimitError extends Error {
  constructor() {
    super("Unable to enforce assistant usage limits.");
    this.name = "AssistantRateLimitError";
  }
}

export async function checkAssistantRateLimit(
  supabase: SupabaseClient<Database>,
  user: Pick<User, "id">,
): Promise<AssistantRateLimitResult> {
  if (!user.id) throw new AssistantRateLimitError();

  const { data, error } = await supabase.rpc("check_ai_assistant_rate_limit");
  const result = data?.[0];

  if (
    error
    || !result
    || typeof result.allowed !== "boolean"
    || !Number.isInteger(result.retry_after_seconds)
    || result.retry_after_seconds < 0
  ) {
    throw new AssistantRateLimitError();
  }

  return {
    allowed: result.allowed,
    retryAfterSeconds: result.allowed ? 0 : Math.max(1, result.retry_after_seconds),
  };
}

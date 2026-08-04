import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  AssistantRateLimitError,
  checkAssistantRateLimit,
} from "@/lib/ai-assistant/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

describe("assistant beta rate limit", () => {
  function clientWithRpcResult(result: unknown, error: unknown = null) {
    const rpc = vi.fn().mockResolvedValue({ data: result, error });
    return {
      client: { rpc } as unknown as SupabaseClient<Database>,
      rpc,
    };
  }

  it("uses the authenticated database RPC without accepting caller-supplied quota keys", async () => {
    const { client, rpc } = clientWithRpcResult([{
      allowed: true,
      retry_after_seconds: 0,
    }]);

    await expect(checkAssistantRateLimit(client, { id: "user-123" })).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(rpc).toHaveBeenCalledWith("check_ai_assistant_rate_limit");
  });

  it("returns the shared retry delay for a rejected request", async () => {
    const { client } = clientWithRpcResult([{
      allowed: false,
      retry_after_seconds: 37,
    }]);

    await expect(checkAssistantRateLimit(client, { id: "user-123" })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 37,
    });
  });

  it("fails closed when the database cannot enforce the quota", async () => {
    const unavailable = clientWithRpcResult(null, { message: "connection failed" });
    const malformed = clientWithRpcResult([]);

    await expect(checkAssistantRateLimit(unavailable.client, { id: "user-123" }))
      .rejects.toBeInstanceOf(AssistantRateLimitError);
    await expect(checkAssistantRateLimit(malformed.client, { id: "user-123" }))
      .rejects.toBeInstanceOf(AssistantRateLimitError);
  });
});

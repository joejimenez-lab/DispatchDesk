import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createAuthenticatedRouteClient: vi.fn(),
  runAiAssistant: vi.fn(),
  isAiAssistantUserAllowed: vi.fn(),
  checkAssistantRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/route-auth", () => ({
  createAuthenticatedRouteClient: mocks.createAuthenticatedRouteClient,
}));
vi.mock("@/lib/ai-assistant/assistant", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai-assistant/assistant")>()),
  runAiAssistant: mocks.runAiAssistant,
}));
vi.mock("@/lib/ai-assistant/access", () => ({
  isAiAssistantUserAllowed: mocks.isAiAssistantUserAllowed,
}));
vi.mock("@/lib/ai-assistant/rate-limit", () => ({
  checkAssistantRateLimit: mocks.checkAssistantRateLimit,
}));

import { POST } from "./route";

function assistantRequest(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/ai-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("AI assistant route", () => {
  beforeEach(() => {
    mocks.createAuthenticatedRouteClient.mockReset();
    mocks.runAiAssistant.mockReset();
    mocks.isAiAssistantUserAllowed.mockReset();
    mocks.checkAssistantRateLimit.mockReset();
    mocks.createAuthenticatedRouteClient.mockResolvedValue({ supabase: { rls: true }, user: { id: "user-1", email: "allowed@example.com" } });
    mocks.isAiAssistantUserAllowed.mockResolvedValue(true);
    mocks.checkAssistantRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("fails closed for a signed-in user outside the beta before quota or provider work", async () => {
    mocks.isAiAssistantUserAllowed.mockResolvedValue(false);

    const response = await POST(assistantRequest({ messages: [{ role: "user", content: "Hello" }] }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "not_found", message: "Not found." },
    });
    expect(mocks.checkAssistantRateLimit).not.toHaveBeenCalled();
    expect(mocks.runAiAssistant).not.toHaveBeenCalled();
  });

  it("requires authentication and preserves the public error contract", async () => {
    mocks.createAuthenticatedRouteClient.mockResolvedValue({ response: new Response(null, { status: 401 }) });

    const response = await POST(assistantRequest({ messages: [{ role: "user", content: "Hello" }] }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Please sign in to use Dispatch Assistant." },
    });
    expect(mocks.runAiAssistant).not.toHaveBeenCalled();
  });

  it("validates JSON conversations before invoking the provider", async () => {
    const response = await POST(assistantRequest({ messages: [{ role: "assistant", content: "No user prompt" }] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "invalid_request", message: "Check the conversation and try again." },
    });
    expect(mocks.checkAssistantRateLimit).not.toHaveBeenCalled();
    expect(mocks.runAiAssistant).not.toHaveBeenCalled();
  });

  it("returns the UI success contract with no-store caching", async () => {
    mocks.runAiAssistant.mockResolvedValue({
      message: "You have 12 drivers.",
      links: [{ label: "View drivers", href: "/drivers" }],
      meta: { model: "moonshotai/kimi-k2.6", toolCalls: ["count_drivers"], generatedAt: "2026-08-04T12:00:00.000Z" },
    });

    const response = await POST(assistantRequest({ messages: [{ role: "user", content: "How many drivers?" }] }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ message: "You have 12 drivers." });
    expect(mocks.isAiAssistantUserAllowed).toHaveBeenCalledWith(
      { rls: true },
      { id: "user-1", email: "allowed@example.com" },
    );
    expect(mocks.checkAssistantRateLimit).toHaveBeenCalledWith(
      { rls: true },
      { id: "user-1", email: "allowed@example.com" },
    );
    expect(mocks.runAiAssistant).toHaveBeenCalledWith({ rls: true }, [{ role: "user", content: "How many drivers?" }]);
  });

  it("fails closed when shared usage limits are unavailable", async () => {
    mocks.checkAssistantRateLimit.mockRejectedValue(new Error("quota unavailable"));

    const response = await POST(assistantRequest({ messages: [{ role: "user", content: "How many drivers?" }] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "usage_limits_unavailable",
        message: "Dispatch Assistant is temporarily unavailable. Please try again later.",
      },
    });
    expect(mocks.runAiAssistant).not.toHaveBeenCalled();
  });

  it("returns the shared retry delay when the quota is exhausted", async () => {
    mocks.checkAssistantRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 37 });

    const response = await POST(assistantRequest({ messages: [{ role: "user", content: "How many drivers?" }] }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(mocks.runAiAssistant).not.toHaveBeenCalled();
  });

  it("rejects non-JSON and oversized requests", async () => {
    const nonJson = await POST(new Request("http://localhost/api/ai-assistant", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    }));
    const oversized = await POST(assistantRequest(
      { messages: [{ role: "user", content: "hello" }] },
      { "Content-Length": "32001" },
    ));

    expect(nonJson.status).toBe(415);
    expect(oversized.status).toBe(413);
  });

  it("rejects cross-origin browser requests", async () => {
    const response = await POST(assistantRequest(
      { messages: [{ role: "user", content: "How many drivers?" }] },
      { Origin: "https://malicious.example" },
    ));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "forbidden_origin", message: "This request is not allowed." },
    });
  });
});

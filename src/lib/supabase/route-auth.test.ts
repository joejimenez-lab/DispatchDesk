import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}));

function clientWithAuthResult(result: unknown) {
  return {
    auth: {
      getUser: vi.fn(async () => result),
    },
  };
}

const context = {
  method: "GET",
  path: "/api/loads/export",
  route: "/api/loads/export",
  kind: "api" as const,
};

describe("route auth guard", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("returns JSON 401 for confirmed missing sessions", async () => {
    createClient.mockResolvedValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 },
    }));
    const { createAuthenticatedRouteClient } = await import("./route-auth");

    const result = await createAuthenticatedRouteClient(context);

    expect("response" in result).toBe(true);
    if (result.response) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({ error: "Unauthorized" });
    }
  });

  it("returns JSON 503 for auth dependency failures", async () => {
    createClient.mockResolvedValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "fetch failed", status: 503 },
    }));
    const { createAuthenticatedRouteClient } = await import("./route-auth");

    const result = await createAuthenticatedRouteClient(context);

    expect("response" in result).toBe(true);
    if (result.response) {
      expect(result.response.status).toBe(503);
      await expect(result.response.json()).resolves.toEqual({ error: "Authentication service unavailable" });
    }
  });
});

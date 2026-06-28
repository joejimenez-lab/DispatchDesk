import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({ createServerClient }));

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost"));
}

function clientWithAuthResult(result: unknown) {
  return {
    auth: {
      getUser: vi.fn(async () => result),
    },
  };
}

describe("middleware auth handling", () => {
  beforeEach(() => {
    vi.resetModules();
    createServerClient.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("allows a valid protected-page session", async () => {
    const { middleware } = await import("./middleware");
    createServerClient.mockReturnValue(clientWithAuthResult({ data: { user: { id: "user-1" } }, error: null }));

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a valid session away from login", async () => {
    const { middleware } = await import("./middleware");
    createServerClient.mockReturnValue(clientWithAuthResult({ data: { user: { id: "user-1" } }, error: null }));

    const response = await middleware(request("/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirects a confirmed missing page session to login", async () => {
    const { middleware } = await import("./middleware");
    createServerClient.mockReturnValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 },
    }));

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("returns JSON 401 for a confirmed missing API session", async () => {
    const { middleware } = await import("./middleware");
    createServerClient.mockReturnValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthApiError", message: "Session expired", status: 401, code: "session_expired" },
    }));

    const response = await middleware(request("/api/loads/export"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns JSON 503 for API auth dependency failures", async () => {
    const { middleware } = await import("./middleware");
    createServerClient.mockReturnValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "fetch failed", status: 503 },
    }));

    const response = await middleware(request("/api/loads/export"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Authentication service unavailable" });
  });

  it("returns retryable HTML 503 for page auth dependency failures", async () => {
    const { middleware } = await import("./middleware");
    createServerClient.mockReturnValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "fetch failed", status: 503 },
    }));

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("Authentication is temporarily unavailable");
  });
});

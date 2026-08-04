import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseConfig: vi.fn(),
  getVerifiedUser: vi.fn(),
  logAuthUnavailable: vi.fn(),
  missingSupabaseConfigResult: vi.fn(),
  notFound: vi.fn(() => { throw new Error("not-found"); }),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/auth-state", () => ({
  getSupabaseConfig: mocks.getSupabaseConfig,
  getVerifiedUser: mocks.getVerifiedUser,
  logAuthUnavailable: mocks.logAuthUnavailable,
  missingSupabaseConfigResult: mocks.missingSupabaseConfigResult,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));

import { isAiAssistantUserAllowed, requireAiAssistantPageAccess } from "@/lib/ai-assistant/access";

function membershipClient(result: { data: { role: string } | null; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  return { from: vi.fn(() => query), query };
}

describe("assistant beta access", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("AI_ASSISTANT_ENABLED", "true");
    vi.stubEnv("AI_ASSISTANT_ALLOWED_EMAILS", "dispatcher@example.com");
    vi.stubEnv("AI_ASSISTANT_ALLOWED_USER_IDS", "user-2");
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.getSupabaseConfig.mockReturnValue({ url: "https://supabase.example", anonKey: "anon" });
  });

  it("requires enabled, allowlisted, owner access", async () => {
    const user = { id: "user-1", email: "dispatcher@example.com" };
    const owner = membershipClient({ data: { role: "owner" }, error: null });
    await expect(isAiAssistantUserAllowed(owner as never, user as never)).resolves.toBe(true);
    await expect(isAiAssistantUserAllowed(
      owner as never,
      { id: "user-2", email: "other@example.com" } as never,
    )).resolves.toBe(true);

    vi.stubEnv("AI_ASSISTANT_ENABLED", "false");
    await expect(isAiAssistantUserAllowed(owner as never, user as never)).resolves.toBe(false);
    vi.stubEnv("AI_ASSISTANT_ENABLED", "true");
    vi.stubEnv("AI_ASSISTANT_ALLOWED_EMAILS", "");
    vi.stubEnv("AI_ASSISTANT_ALLOWED_USER_IDS", "");
    await expect(isAiAssistantUserAllowed(owner as never, user as never)).resolves.toBe(false);
  });

  it("normalizes allowlisted emails", async () => {
    vi.stubEnv("AI_ASSISTANT_ALLOWED_EMAILS", " First@Example.com, SECOND@example.com ");
    const owner = membershipClient({ data: { role: "owner" }, error: null });
    await expect(isAiAssistantUserAllowed(
      owner as never,
      { id: "user-1", email: "second@EXAMPLE.com" } as never,
    )).resolves.toBe(true);
  });

  it("fails closed for members, missing memberships, and query failures", async () => {
    const user = { id: "user-1", email: "dispatcher@example.com" };
    const member = membershipClient({ data: { role: "member" }, error: null });
    const missing = membershipClient({ data: null, error: null });
    const failed = membershipClient({ data: null, error: new Error("unavailable") });

    await expect(isAiAssistantUserAllowed(member as never, user as never)).resolves.toBe(false);
    await expect(isAiAssistantUserAllowed(missing as never, user as never)).resolves.toBe(false);
    await expect(isAiAssistantUserAllowed(failed as never, user as never)).resolves.toBe(false);
  });

  it("redirects an unauthenticated page request to login", async () => {
    mocks.createClient.mockResolvedValue(membershipClient({ data: { role: "owner" }, error: null }));
    mocks.getVerifiedUser.mockResolvedValue({ status: "unauthenticated", reason: "missing_user" });

    await expect(requireAiAssistantPageAccess()).rejects.toThrow("redirect:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("returns not found for a signed-in user outside the beta", async () => {
    mocks.createClient.mockResolvedValue(membershipClient({ data: { role: "owner" }, error: null }));
    mocks.getVerifiedUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "user-1", email: "not-allowed@example.com" },
    });

    await expect(requireAiAssistantPageAccess()).rejects.toThrow("not-found");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("returns the authenticated RLS client for an allowed user", async () => {
    const user = { id: "user-1", email: "dispatcher@example.com" };
    const supabase = membershipClient({ data: { role: "owner" }, error: null });
    mocks.createClient.mockResolvedValue(supabase);
    mocks.getVerifiedUser.mockResolvedValue({ status: "authenticated", user });

    await expect(requireAiAssistantPageAccess()).resolves.toEqual({ supabase, user });
    expect(supabase.from).toHaveBeenCalledWith("organization_members");
    expect(supabase.query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(supabase.query.eq).toHaveBeenCalledWith("role", "owner");
  });

  it("returns not found when an allowlisted page user is not an owner", async () => {
    const user = { id: "user-1", email: "dispatcher@example.com" };
    const supabase = membershipClient({ data: { role: "member" }, error: null });
    mocks.createClient.mockResolvedValue(supabase);
    mocks.getVerifiedUser.mockResolvedValue({ status: "authenticated", user });

    await expect(requireAiAssistantPageAccess()).rejects.toThrow("not-found");
    expect(mocks.notFound).toHaveBeenCalled();
  });
});

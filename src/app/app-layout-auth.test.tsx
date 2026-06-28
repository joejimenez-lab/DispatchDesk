import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));
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

describe("protected app layout auth handling", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockReset();
    redirect.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redirects only confirmed unauthenticated users to login", async () => {
    createClient.mockResolvedValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 },
    }));
    const { default: AppLayout } = await import("./(app)/layout");

    await expect(AppLayout({ children: <div>Protected</div> })).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders retryable unavailable UI for auth dependency failures", async () => {
    createClient.mockResolvedValue(clientWithAuthResult({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "fetch failed", status: 503 },
    }));
    const { default: AppLayout } = await import("./(app)/layout");

    const element = await AppLayout({ children: <div>Protected</div> });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Authentication is temporarily unavailable");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Protected");
    expect(redirect).not.toHaveBeenCalled();
  });
});

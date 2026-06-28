import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("__NEXT_NOT_FOUND__");
});
const createClient = vi.fn();

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

function clientWithSingleResult(result: unknown) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => result),
        })),
      })),
    })),
  };
}

describe("detail data loaders", () => {
  beforeEach(() => {
    notFound.mockClear();
    createClient.mockReset();
  });

  it("returns a true 404 for a missing dynamic load record", async () => {
    const { getLoad } = await import("./loads");
    createClient.mockResolvedValue(clientWithSingleResult({
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
    }));

    await expect(getLoad("missing-load")).rejects.toThrow("__NEXT_NOT_FOUND__");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("throws operational Supabase failures instead of labeling them not found", async () => {
    const { getLoad } = await import("./loads");
    const serverError = { code: "PGRST500", message: "upstream unavailable" };
    createClient.mockResolvedValue(clientWithSingleResult({
      data: null,
      error: serverError,
    }));

    await expect(getLoad("errored-load")).rejects.toBe(serverError);
    expect(notFound).not.toHaveBeenCalled();
  });
});

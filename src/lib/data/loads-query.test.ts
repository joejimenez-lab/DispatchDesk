import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const getLoadIndexPage = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/data/load-index", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/data/load-index")>();
  return { ...original, getLoadIndexPage };
});

describe("getLoads database pagination", () => {
  beforeEach(() => {
    createClient.mockReset();
    getLoadIndexPage.mockReset();
  });

  it("fetches details only for the ordered IDs on the selected index page", async () => {
    getLoadIndexPage.mockResolvedValue({ ids: ["load-2", "load-1"], total: 74 });
    const details = {
      in: vi.fn().mockResolvedValue({
        data: [{ id: "load-1", load_stops: [] }, { id: "load-2", load_stops: [] }],
        error: null,
      }),
    };
    const supabase = { from: vi.fn(() => ({ select: vi.fn(() => details) })) };
    createClient.mockResolvedValue(supabase);
    const { getLoads } = await import("./loads");

    const result = await getLoads({
      q: "Dallas",
      status: "Delivered",
      payment: "paid",
      financial: "complete",
      fleetScope: { kind: "fleet", company: "West Fleet" },
      pagination: { page: 2, pageSize: 25 },
    });

    expect(getLoadIndexPage).toHaveBeenCalledWith(supabase, expect.objectContaining({
      q: "Dallas",
      status: "Delivered",
      payment: "paid",
      financial: "complete",
      fleetScope: { kind: "fleet", company: "West Fleet" },
    }), { page: 2, pageSize: 25 });
    expect(details.in).toHaveBeenCalledWith("id", ["load-2", "load-1"]);
    expect(result.items.map((load) => load.id)).toEqual(["load-2", "load-1"]);
    expect(result.total).toBe(74);
  });

  it("does not issue an unbounded detail query for an empty page", async () => {
    getLoadIndexPage.mockResolvedValue({ ids: [], total: 0 });
    const supabase = { from: vi.fn() };
    createClient.mockResolvedValue(supabase);
    const { getLoads } = await import("./loads");

    const result = await getLoads({ pagination: { page: 1, pageSize: 50 } });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ items: [], total: 0, page: 1, pageSize: 50 });
  });
});

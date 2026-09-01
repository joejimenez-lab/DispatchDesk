import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));

function mainQuery(data: unknown[] = [], count = data.length) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    is: vi.fn(),
    or: vi.fn(),
    range: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.range.mockResolvedValue({ data, count, error: null });
  return query;
}

describe("getLoads database pagination", () => {
  beforeEach(() => createClient.mockReset());

  it("combines filters and requests only the selected server range", async () => {
    const query = mainQuery([{ id: "load-26", load_stops: [] }], 74);
    createClient.mockResolvedValue({ from: vi.fn(() => query) });
    const { getLoads } = await import("./loads");

    const result = await getLoads({
      status: "Delivered",
      broker: "broker-id",
      driver: "driver-id",
      fleetScope: { kind: "fleet", company: "West Fleet" },
      pagination: { page: 2, pageSize: 25 },
    });

    expect(query.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(query.eq).toHaveBeenCalledWith("status", "Delivered");
    expect(query.eq).toHaveBeenCalledWith("broker_id", "broker-id");
    expect(query.eq).toHaveBeenCalledWith("driver_id", "driver-id");
    expect(query.eq).toHaveBeenCalledWith("fleet_company", "West Fleet");
    expect(query.range).toHaveBeenCalledWith(25, 49);
    expect(result).toMatchObject({ total: 74, page: 2, pageSize: 25 });
    expect(result.items).toHaveLength(1);
  });

  it("uses the operational status set for the default view", async () => {
    const query = mainQuery([], 0);
    createClient.mockResolvedValue({ from: vi.fn(() => query) });
    const { getLoads } = await import("./loads");

    await getLoads({ pagination: { page: 1, pageSize: 50 } });

    expect(query.in).toHaveBeenCalledWith("status", ["Booked", "Dispatched", "Picked Up", "In Transit"]);
    expect(query.range).toHaveBeenCalledWith(0, 49);
  });

  it("lets closeout filters take precedence over the default active view", async () => {
    const query = mainQuery([], 0);
    createClient.mockResolvedValue({ from: vi.fn(() => query) });
    const { getLoads } = await import("./loads");

    await getLoads({ closeout: "all-open", pagination: { page: 1, pageSize: 25 } });

    expect(query.in).not.toHaveBeenCalledWith("status", expect.anything());
    expect(query.eq).toHaveBeenCalledWith("status", "Delivered");
    expect(query.or).toHaveBeenCalledWith("post_delivery_status.is.null,post_delivery_status.neq.Closed");
  });
});

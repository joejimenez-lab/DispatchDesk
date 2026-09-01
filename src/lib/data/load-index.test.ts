import { describe, expect, it, vi } from "vitest";
import { getAllLoadIndexIds, getLoadIndexPage } from "./load-index";

function indexQuery(responses: { data: { id: string }[]; count: number | null; error: null }[]) {
  const query = {
    select: vi.fn(), order: vi.fn(), in: vi.fn(), gte: vi.fn(), eq: vi.fn(), neq: vi.fn(),
    is: vi.fn(), or: vi.fn(), ilike: vi.fn(), range: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  for (const response of responses) query.range.mockResolvedValueOnce(response);
  return query;
}

describe("load list index", () => {
  it("combines server-side search, filters, counts, and range pagination", async () => {
    const query = indexQuery([{ data: [{ id: "load-26" }], count: 74, error: null }]);
    const supabase = { from: vi.fn(() => query) } as never;

    const result = await getLoadIndexPage(supabase, {
      q: "Dallas Riley",
      status: "active",
      broker: "broker-id",
      driver: "driver-id",
      payment: "paid",
      financial: "complete",
      fleetScope: { kind: "fleet", company: "West Fleet" },
    }, { page: 2, pageSize: 25 });

    expect(query.in).toHaveBeenCalledWith("status", ["Booked", "Dispatched", "Picked Up", "In Transit"]);
    expect(query.eq).toHaveBeenCalledWith("broker_id", "broker-id");
    expect(query.eq).toHaveBeenCalledWith("driver_id", "driver-id");
    expect(query.eq).toHaveBeenCalledWith("fleet_company", "West Fleet");
    expect(query.eq).toHaveBeenCalledWith("client_paid", true);
    expect(query.eq).toHaveBeenCalledWith("driver_pay_known", true);
    expect(query.ilike).toHaveBeenNthCalledWith(1, "search_text", "%Dallas%");
    expect(query.ilike).toHaveBeenNthCalledWith(2, "search_text", "%Riley%");
    expect(query.range).toHaveBeenCalledWith(25, 49);
    expect(result).toEqual({ ids: ["load-26"], total: 74 });
  });

  it("lets closeout filters override the active transportation default", async () => {
    const query = indexQuery([{ data: [], count: 0, error: null }]);
    await getLoadIndexPage({ from: vi.fn(() => query) } as never, {
      status: "active",
      closeout: "all-open",
    }, { page: 1, pageSize: 25 });

    expect(query.in).not.toHaveBeenCalledWith("status", expect.anything());
    expect(query.eq).toHaveBeenCalledWith("status", "Delivered");
    expect(query.or).toHaveBeenCalledWith("post_delivery_status.is.null,post_delivery_status.neq.Closed");
  });

  it("chunks complete export ID retrieval past the PostgREST row cap", async () => {
    const first = Array.from({ length: 1_000 }, (_, index) => ({ id: `load-${index}` }));
    const query = indexQuery([
      { data: first, count: null, error: null },
      { data: [{ id: "load-1000" }], count: null, error: null },
    ]);

    const ids = await getAllLoadIndexIds({ from: vi.fn(() => query) } as never, { status: "all" });

    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(ids).toHaveLength(1_001);
  });
});

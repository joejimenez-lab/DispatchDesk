import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));

function reportQuery(response: { data: unknown[]; count: number | null; error: null }) {
  const query = {
    select: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    or: vi.fn(),
    range: vi.fn(),
    then: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.range.mockResolvedValue(response);
  query.then.mockImplementation((resolve, reject) => Promise.resolve(response).then(resolve, reject));
  return query;
}

function weeklyLoad(id: string) {
  return {
    id,
    load_number: id.toUpperCase(),
    status: "Delivered",
    pickup_date: "2026-07-07",
    delivery_date: "2026-07-08",
    is_round_trip: false,
    return_location: null,
    round_trip_details: null,
    load_rate: 1000,
    driver_pay: 500,
    dispatcher_fee: 100,
    fuel_cost: 50,
    factoring_mode: "percentage",
    factoring_percent: 0,
    factoring_fixed_amount: 0,
    factoring_amount: 0,
    load_deductions: [],
    created_at: "2026-07-01T00:00:00Z",
    driver_id: null,
    fleet_company: null,
    drivers: null,
  };
}

describe("weekly report detail pagination", () => {
  beforeEach(() => createClient.mockReset());

  it("applies the date range before requesting a bounded detail page", async () => {
    const fullQuery = reportQuery({ data: [], count: null, error: null });
    const pageQuery = reportQuery({ data: [], count: 132, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValueOnce(fullQuery).mockReturnValueOnce(pageQuery) });
    const { getWeeklyDriverFinancialSummary } = await import("./weekly-financials");

    const result = await getWeeklyDriverFinancialSummary({
      period: "custom",
      from: "2026-07-01",
      to: "2026-07-31",
      pagination: { page: 2, pageSize: 50 },
    });

    expect(pageQuery.select).toHaveBeenCalledWith("id", { count: "exact" });
    expect(pageQuery.or).toHaveBeenCalledTimes(2);
    expect(pageQuery.or.mock.calls[0][0]).toContain("delivery_date.gte.2026-07-01");
    expect(pageQuery.or.mock.calls[1][0]).toContain("delivery_date.lte.2026-07-31");
    expect(pageQuery.range).toHaveBeenCalledWith(50, 99);
    expect(fullQuery.range).toHaveBeenCalledWith(0, 999);
    expect(result).toMatchObject({ total: 132, summaries: [] });
  });

  it("keeps complete weekly totals while bounding the visible detail rows", async () => {
    const fullQuery = reportQuery({ data: [weeklyLoad("load-1"), weeklyLoad("load-2")], count: null, error: null });
    const pageQuery = reportQuery({ data: [{ id: "load-2" }], count: 2, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValueOnce(fullQuery).mockReturnValueOnce(pageQuery) });
    const { getWeeklyDriverFinancialSummary } = await import("./weekly-financials");

    const result = await getWeeklyDriverFinancialSummary({
      period: "custom",
      from: "2026-07-01",
      to: "2026-07-31",
      pagination: { page: 2, pageSize: 25 },
    });

    expect(result.summaries[0]).toMatchObject({ loadCount: 2, loadRateTotal: 2000 });
    expect(result.summaries[0].loads).toHaveLength(2);
    expect(result.detailSummaries[0]).toMatchObject({ loadCount: 2, loadRateTotal: 2000 });
    expect(result.detailSummaries[0].loads.map((load) => load.id)).toEqual(["load-2"]);
    expect(result.total).toBe(2);
  });
});

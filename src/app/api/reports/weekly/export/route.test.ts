import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthenticatedRouteClient = vi.fn();
const getWeeklyDriverFinancialSummary = vi.fn();

vi.mock("@/lib/supabase/route-auth", () => ({ createAuthenticatedRouteClient }));
vi.mock("@/lib/data/weekly-financials", () => ({ getWeeklyDriverFinancialSummary }));

describe("/api/reports/weekly/export", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedRouteClient.mockReset();
    getWeeklyDriverFinancialSummary.mockReset();
  });

  it("neutralizes formula-like weekly report text while preserving totals", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: {} });
    getWeeklyDriverFinancialSummary.mockResolvedValue({
      range: { from: "2026-01-05", to: "2026-01-11" },
      summaries: [
        {
          weekStart: "2026-01-05",
          weekEnd: "2026-01-11",
          driverName: "=Driver",
          loadCount: 1,
          loadRateTotal: 1000,
          driverPayTotal: 500,
          dispatcherFeeTotal: 100,
          fuelCostTotal: 50,
          estimatedProfitTotal: 350,
          loads: [
            {
              loadNumber: "+LOAD",
              date: "2026-01-06",
              status: "Delivered",
              isRoundTrip: true,
              returnLocation: " @Return",
              roundTripDetails: "\t-Details",
              loadRate: 1000,
              driverPay: 500,
              dispatcherFee: 100,
              fuelCost: 50,
              estimatedProfit: 350,
            },
          ],
        },
      ],
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/reports/weekly/export"));
    const csv = await response.text();

    expect(csv).toContain("'=Driver");
    expect(csv).toContain("'+LOAD");
    expect(csv).toContain("' @Return");
    expect(csv).toContain("'\t-Details");
    expect(csv).toContain(",1000,500,100,50,350,1000,500,100,50,350");
  });
});

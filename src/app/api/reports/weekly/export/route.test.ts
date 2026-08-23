import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthenticatedRouteClient = vi.fn();
const getWeeklyDriverFinancialSummary = vi.fn();

vi.mock("@/lib/supabase/route-auth", () => ({ createAuthenticatedRouteClient }));
vi.mock("@/lib/data/weekly-financials", () => ({ getWeeklyDriverFinancialSummary }));

function catalogClient(companies = ["West"]) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        not: vi.fn(async () => ({
          data: table === "fleet_units"
            ? companies.map((company) => ({ company }))
            : companies.map((fleet_company) => ({ fleet_company })),
          error: null,
        })),
      })),
    })),
  };
}

describe("/api/reports/weekly/export", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedRouteClient.mockReset();
    getWeeklyDriverFinancialSummary.mockReset();
  });

  it("neutralizes formula-like weekly report text while preserving totals", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: catalogClient() });
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
          factoringTotal: 30,
          otherDeductionTotal: 20,
          totalDeductionsTotal: 50,
          estimatedProfitTotal: 300,
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
              factoringMode: "amount",
              factoringPercent: 3,
              factoringFixedAmount: 30,
              factoringAmount: 30,
              otherDeductions: [{ label: "=Lumper", amount: 20 }],
              otherDeductionTotal: 20,
              totalDeductions: 50,
              estimatedProfit: 300,
            },
          ],
        },
      ],
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/reports/weekly/export?fleet=west"));
    if (!response) throw new Error("Expected the weekly export route to return a response");
    const csv = await response.text();

    expect(csv).toContain("'=Driver");
    expect(response.headers.get("content-disposition")).toMatch(/dispatchdesk-weekly-report-west-/);
    expect(csv).toContain("'+LOAD");
    expect(csv).toContain("' @Return");
    expect(csv).toContain("'\t-Details");
    expect(csv).toContain("'=Lumper: 20.00");
    expect(csv).toContain(",1000,500,100,50,Fixed amount,30,30,20,");
    expect(csv).toContain(",50,300,1000,500,100,50,30,20,50,300");
    expect(getWeeklyDriverFinancialSummary).toHaveBeenCalledWith(expect.objectContaining({
      fleetScope: { kind: "fleet", company: "West" },
    }));
  });

  it("returns 400 for a fleet outside the authenticated tenant catalogue", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: catalogClient() });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/reports/weekly/export?fleet=Unknown"));
    if (!response) throw new Error("Expected an export response");

    expect(response.status).toBe(400);
    expect(getWeeklyDriverFinancialSummary).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthenticatedRouteClient = vi.fn();
const getWeeklyDriverFinancialSummary = vi.fn();

vi.mock("@/lib/supabase/route-auth", () => ({ createAuthenticatedRouteClient }));
vi.mock("@/lib/data/weekly-financials", () => ({ getWeeklyDriverFinancialSummary }));

const summary = {
  key: "2026-01-05:driver-1",
  weekStart: "2026-01-05",
  weekEnd: "2026-01-11",
  driverId: "driver-1",
  driverName: "Jamie Driver",
  loadCount: 2,
  loadRateTotal: 2400,
  driverPayTotal: 1200,
  dispatcherFeeTotal: 240,
  fuelCostTotal: 300,
  factoringTotal: 72,
  otherDeductionTotal: 40,
  totalDeductionsTotal: 112,
  estimatedProfitTotal: 548,
  loads: [],
};

describe("/api/reports/exports/[report]", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedRouteClient.mockReset();
    getWeeklyDriverFinancialSummary.mockReset();
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: {} });
    getWeeklyDriverFinancialSummary.mockResolvedValue({
      summaries: [summary],
      range: { from: "2026-01-05", to: "2026-01-11" },
    });
  });

  it("keeps CSV as the default and preserves report filters", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/reports/exports/weekly-payroll?period=custom&from=2026-01-05&to=2026-01-11&driver=123e4567-e89b-42d3-a456-426614174000&fleet=West"),
      { params: Promise.resolve({ report: "weekly-payroll" }) },
    );
    if (!response) throw new Error("Expected a report export response");

    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(/dispatchdesk-weekly-payroll-\d{4}-\d{2}-\d{2}\.csv/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getWeeklyDriverFinancialSummary).toHaveBeenCalledWith({
      period: "custom",
      from: "2026-01-05",
      to: "2026-01-11",
      driver: "123e4567-e89b-42d3-a456-426614174000",
      fleet: "West",
    });
  });

  it("returns a PDF for supported report formats", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/reports/exports/weekly-payroll?format=pdf"),
      { params: Promise.resolve({ report: "weekly-payroll" }) },
    );
    if (!response) throw new Error("Expected a report export response");

    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/dispatchdesk-weekly-payroll-\d{4}-\d{2}-\d{2}\.pdf/);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects invalid formats before querying report data", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/reports/exports/weekly-payroll?format=xlsx"),
      { params: Promise.resolve({ report: "weekly-payroll" }) },
    );
    if (!response) throw new Error("Expected a report export response");

    expect(response.status).toBe(400);
    expect(getWeeklyDriverFinancialSummary).not.toHaveBeenCalled();
  });
});

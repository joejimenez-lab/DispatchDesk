import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthenticatedRouteClient = vi.fn();
const getWeeklyDriverFinancialSummary = vi.fn();

vi.mock("@/lib/supabase/route-auth", () => ({ createAuthenticatedRouteClient }));
vi.mock("@/lib/data/weekly-financials", () => ({ getWeeklyDriverFinancialSummary }));

function catalogClient(companies: string[]) {
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

describe("/api/reports/weekly/pdf", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedRouteClient.mockReset();
    getWeeklyDriverFinancialSummary.mockReset();
  });

  it("returns 400 for a fleet outside the authenticated tenant catalogue", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: catalogClient(["West"]) });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/reports/weekly/pdf?fleet=Unknown"));
    if (!response) throw new Error("Expected an export response");

    expect(response.status).toBe(400);
    expect(getWeeklyDriverFinancialSummary).not.toHaveBeenCalled();
  });
});

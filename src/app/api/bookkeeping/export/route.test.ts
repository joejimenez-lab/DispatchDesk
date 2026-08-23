import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthenticatedRouteClient = vi.fn();

vi.mock("@/lib/supabase/route-auth", () => ({ createAuthenticatedRouteClient }));

function queryResult(data: unknown[]) {
  const result = { data, error: null };
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "gte", "lte", "eq"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

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

const expense = {
  id: "group-1",
  expense_date: "2026-01-12",
  vendor: "Road Fuel",
  notes: null,
  source_type: "manual",
  bookkeeping_expenses: [{ id: "line-1", category: "Fuel", amount: 125, line_type: "expense" }],
  bookkeeping_receipts: [{ id: "receipt-1", file_name: "fuel.pdf" }],
  fleet_units: { id: "unit-1", unit_number: "T-1", unit_type: "Truck", company: "West" },
  loads: null,
  drivers: null,
  service_records: null,
  inspection_records: null,
  repair_logs: null,
  ifta_fuel_purchases: null,
  amount: 125,
  category: "Fuel",
};

describe("/api/bookkeeping/export", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedRouteClient.mockReset();
  });

  it("returns a filtered summary CSV with a descriptive filename", async () => {
    const query = queryResult([expense]);
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: { from: vi.fn(() => query) } });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/bookkeeping/export?from=2026-01-01&to=2026-01-31&view=summary&format=csv"));
    if (!response) throw new Error("Expected a bookkeeping export response");

    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(/dispatchdesk-bookkeeping-summary-all-fleets-\d{4}-\d{2}-\d{2}\.csv/);
    expect(await response.text()).toContain("Fuel,1,1,125.00");
    expect(query.gte).toHaveBeenCalledWith("expense_date", "2026-01-01");
    expect(query.lte).toHaveBeenCalledWith("expense_date", "2026-01-31");
  });

  it("returns a detailed bookkeeping PDF", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: { from: vi.fn(() => queryResult([expense])) } });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/bookkeeping/export?view=detailed&format=pdf"));
    if (!response) throw new Error("Expected a bookkeeping export response");

    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/dispatchdesk-bookkeeping-detailed-all-fleets-\d{4}-\d{2}-\d{2}\.pdf/);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects invalid export controls", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: {} });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/bookkeeping/export?view=raw&format=xlsx"));
    if (!response) throw new Error("Expected a bookkeeping export response");

    expect(response.status).toBe(400);
  });

  it("returns 400 for a fleet outside the authenticated tenant catalogue", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: catalogClient(["West"]) });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/bookkeeping/export?fleet=Unknown"));
    if (!response) throw new Error("Expected an export response");

    expect(response.status).toBe(400);
  });
});

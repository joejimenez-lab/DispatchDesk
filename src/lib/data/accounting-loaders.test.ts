import { beforeEach, describe, expect, it, vi } from "vitest";
const createClient = vi.fn();
vi.mock("@/lib/supabase/authenticated", () => ({ requireAuthenticatedClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const loads = [
  { id: "dc", load_number: "DC-CROSS", accounting_company: "DC", fleet_company: "RD", status: "Booked", load_rate: 1200, driver_pay: 500, dispatcher_fee: 50, fuel_cost: 100, factoring_amount: 0, load_deductions: [], payments: null },
  { id: "rd", load_number: "RD-CROSS", accounting_company: "RD", fleet_company: "DC", status: "Booked", load_rate: 2200, driver_pay: 500, dispatcher_fee: 50, fuel_cost: 100, factoring_amount: 0, load_deductions: [], payments: null },
  { id: "missing", load_number: "UNKNOWN", accounting_company: null, fleet_company: "DC", status: "Booked", load_rate: 300, driver_pay: 0, dispatcher_fee: 0, fuel_cost: 0, factoring_amount: 0, load_deductions: [], payments: null },
];
function queryFor(rows: Record<string, unknown>[]) {
  let filtered = rows;
  const query = {
    select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
    eq: vi.fn((key: string, value: unknown) => { filtered = filtered.filter((row) => row[key] === value); return query; }),
    is: vi.fn((key: string, value: unknown) => { filtered = filtered.filter((row) => row[key] === value); return query; }),
    range: vi.fn(async (from: number, to: number) => ({ data: filtered.slice(from, to + 1), error: null })),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: filtered, error: null }).then(resolve),
  };
  return query;
}
beforeEach(() => createClient.mockReset());
describe("accounting load attribution", () => {
  it("dashboard totals follow each carrier and all/unassigned remain accurate", async () => {
    createClient.mockImplementation(async () => ({ from: (table: string) => queryFor(table === "loads" ? loads : []) }));
    const { getDashboardMetrics } = await import("./dashboard");
    const dc = await getDashboardMetrics({ kind: "company", company: "DC" });
    expect(dc.totalRevenue).toBe(1200);
    expect(dc.currentLoads.map((load) => load.id)).toEqual(["dc"]);
    expect((await getDashboardMetrics({ kind: "company", company: "RD" })).totalRevenue).toBe(2200);
    expect((await getDashboardMetrics({ kind: "all" })).totalRevenue).toBe(3700);
    expect((await getDashboardMetrics({ kind: "unassigned" })).totalRevenue).toBe(300);
  });
  it("invoice lists and new invoice selection follow the carrier", async () => {
    createClient.mockImplementation(async () => ({ from: (table: string) => queryFor(table === "loads" ? loads : loads.map((load) => ({ id: load.id, loads: load, invoice_status: "Draft" }))) }));
    const { getInvoices, getInvoiceLoadOptions } = await import("./invoices");
    expect((await getInvoices({ kind: "company", company: "DC" })).map((invoice) => invoice.id)).toEqual(["dc"]);
    expect((await getInvoiceLoadOptions({ kind: "company", company: "RD" })).map((load) => load.id)).toEqual(["rd"]);
    expect((await getInvoiceLoadOptions({ kind: "unassigned" })).map((load) => load.id)).toEqual(["missing"]);
  });
});

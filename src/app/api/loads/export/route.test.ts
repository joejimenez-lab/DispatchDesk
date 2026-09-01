import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthenticatedRouteClient = vi.fn();

vi.mock("@/lib/supabase/route-auth", () => ({ createAuthenticatedRouteClient }));

function loadsClient(data: unknown[]) {
  const rows = data.map((row, index) => ({ id: `load-${index}`, ...(row as object) }));
  const indexQuery = {
    select: vi.fn(), order: vi.fn(), in: vi.fn(), gte: vi.fn(), eq: vi.fn(), neq: vi.fn(),
    is: vi.fn(), or: vi.fn(), ilike: vi.fn(), range: vi.fn(),
  };
  indexQuery.select.mockReturnValue(indexQuery);
  indexQuery.order.mockReturnValue(indexQuery);
  indexQuery.in.mockReturnValue(indexQuery);
  indexQuery.gte.mockReturnValue(indexQuery);
  indexQuery.eq.mockReturnValue(indexQuery);
  indexQuery.neq.mockReturnValue(indexQuery);
  indexQuery.is.mockReturnValue(indexQuery);
  indexQuery.or.mockReturnValue(indexQuery);
  indexQuery.ilike.mockReturnValue(indexQuery);
  indexQuery.range.mockResolvedValue({ data: rows.map(({ id }) => ({ id })), error: null });
  return {
    from: vi.fn((table: string) => table === "load_list_index"
      ? indexQuery
      : { select: vi.fn(() => ({ in: vi.fn(async () => ({ data: rows, error: null })) })) }),
  };
}

function catalogueClient(companies: string[]) {
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

function exportLoad(loadNumber: string) {
  return {
    load_number: loadNumber,
    status: "Delivered",
    pickup_location: "Dallas, TX",
    pickup_date: "2026-08-01",
    delivery_location: "Memphis, TN",
    delivery_date: "2026-08-02",
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
    load_stops: [],
    brokers: null,
    drivers: null,
    payments: null,
    receivable_entries: [],
  };
}

describe("/api/loads/export", () => {
  beforeEach(() => {
    vi.resetModules();
    createAuthenticatedRouteClient.mockReset();
  });

  it("neutralizes formula-like text while preserving numeric and boolean values", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({
      supabase: loadsClient([
        {
          load_number: "=LOAD",
          status: "Delivered",
          brokers: { company_name: "+Broker", contact_name: "@Contact" },
          carrier_company: "-Carrier",
          fleet_company: "Fleet A",
          truck_number: "LOAD-TRK",
          trailer_number: "LOAD-TRL",
          drivers: { name: "\t=Driver", truck_number: "DRIVER-TRK", trailer_number: "DRIVER-TRL" },
          pickup_location: " =Pickup",
          pickup_date: "2026-01-05",
          delivery_location: "\u0000@Delivery",
          delivery_date: "2026-01-06",
          is_round_trip: false,
          return_location: null,
          round_trip_details: null,
          load_rate: 1000,
          driver_pay: 500,
          dispatcher_fee: 100,
          fuel_cost: 50,
          driver_pay_known: true,
          dispatcher_fee_known: true,
          fuel_cost_known: true,
          factoring_mode: "percentage",
          factoring_percent: 3,
          factoring_fixed_amount: 0,
          factoring_amount: 30,
          load_deductions: [{ label: "=Lumper", amount: 20, position: 0 }],
          notes: "=Notes",
          payments: {
            invoice_status: "Sent",
            invoice_sent: true,
            client_paid: false,
            client_amount_received: 0,
            driver_paid: false,
            driver_amount_paid: 0,
            dispatcher_paid: false,
            dispatcher_fee_amount: 0,
          },
          receivable_entries: [],
        },
      ]),
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/loads/export"));
    if (!response) throw new Error("Expected the export route to return a response");
    const csv = await response.text();

    expect(csv).toContain("'=LOAD");
    expect(csv).toContain("'+Broker");
    expect(csv).toContain("'@Contact");
    expect(csv).toContain("'-Carrier");
    expect(csv).toContain("'\t=Driver");
    expect(csv).toContain("Fleet A");
    expect(response.headers.get("content-disposition")).toMatch(/dispatchdesk-loads-all-fleets-\d{4}-\d{2}-\d{2}\.csv/);
    expect(csv).toContain("LOAD-TRK,LOAD-TRL");
    expect(csv).not.toContain("DRIVER-TRK");
    expect(csv).not.toContain("DRIVER-TRL");
    expect(csv).toContain("' =Pickup");
    expect(csv).toContain("'\u0000@Delivery");
    expect(csv).toContain("'=Notes");
    expect(csv).toContain("'=Lumper: 20.00");
    expect(csv).toContain(",1000,500,100,50,Percentage,3%,30,20,");
    expect(csv).toContain(",50,300,Complete,,true,0,1000,false,false,false,");
  });

  it("returns 400 for a fleet outside the authenticated tenant catalogue", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({ supabase: catalogueClient(["West"]) });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/loads/export?fleet=Unknown"));
    if (!response) throw new Error("Expected an export response");

    expect(response.status).toBe(400);
  });

  it("exports every filtered match regardless of visible page parameters", async () => {
    createAuthenticatedRouteClient.mockResolvedValue({
      supabase: loadsClient([exportLoad("PAGE-ONE"), exportLoad("PAGE-TWO")]),
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/loads/export?page=2&pageSize=1"));
    if (!response) throw new Error("Expected an export response");
    const csv = await response.text();

    expect(csv).toContain("PAGE-ONE");
    expect(csv).toContain("PAGE-TWO");
  });
});

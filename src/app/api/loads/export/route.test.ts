import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuthenticatedRouteClient = vi.fn();

vi.mock("@/lib/supabase/route-auth", () => ({ createAuthenticatedRouteClient }));

function loadsClient(data: unknown[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({ data, error: null })),
      })),
    })),
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
          factoring_mode: "percentage",
          factoring_percent: 3,
          factoring_fixed_amount: 0,
          factoring_amount: 30,
          load_deductions: [{ label: "=Lumper", amount: 20, position: 0 }],
          notes: "=Notes",
          payments: {
            invoice_sent: true,
            client_paid: false,
            client_amount_received: 0,
            driver_paid: false,
            driver_amount_paid: 0,
            dispatcher_paid: false,
            dispatcher_fee_amount: 0,
          },
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
    expect(csv).toContain("LOAD-TRK,LOAD-TRL");
    expect(csv).not.toContain("DRIVER-TRK");
    expect(csv).not.toContain("DRIVER-TRL");
    expect(csv).toContain("' =Pickup");
    expect(csv).toContain("'\u0000@Delivery");
    expect(csv).toContain("'=Notes");
    expect(csv).toContain("'=Lumper: 20.00");
    expect(csv).toContain(",1000,500,100,50,Percentage,3%,30,20,");
    expect(csv).toContain(",50,300,true,0,1000,false,false,false,");
  });
});

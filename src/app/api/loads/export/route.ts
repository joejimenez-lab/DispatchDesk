import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import { clientCollected, clientOutstanding, deductionsTotal, isClientPaymentPaid, profitForLoad, totalDeductionsForLoad } from "@/lib/financials";
import { ilikeOr, searchTokens } from "@/lib/search";
import type { LoadStatus } from "@/types/database";
import { applyFleetScope, fleetScopeSlug, resolveExportFleetScope } from "@/lib/fleet-scope";

const LOAD_SEARCH_COLUMNS = ["load_number", "pickup_location", "delivery_location", "return_location", "carrier_company", "fleet_company", "truck_number", "trailer_number"];

type ExportLoad = {
  load_number: string;
  status: LoadStatus;
  pickup_location: string;
  pickup_date: string | null;
  delivery_location: string;
  delivery_date: string | null;
  is_round_trip: boolean;
  return_location: string | null;
  round_trip_details: string | null;
  load_rate: number;
  driver_pay: number;
  dispatcher_fee: number;
  fuel_cost: number;
  factoring_mode: "percentage" | "amount";
  factoring_percent: number;
  factoring_fixed_amount: number;
  factoring_amount: number;
  load_deductions: { label: string; amount: number; position: number }[];
  carrier_company: string | null;
  fleet_company: string | null;
  truck_number: string | null;
  trailer_number: string | null;
  notes: string | null;
  brokers: { company_name: string | null; contact_name: string | null } | null;
  drivers: { name: string | null } | null;
  payments:
    | {
        invoice_sent: boolean;
        client_paid: boolean;
        client_amount_received: number;
        driver_paid: boolean;
        driver_amount_paid: number;
        dispatcher_paid: boolean;
        dispatcher_fee_amount: number;
      }
    | {
        invoice_sent: boolean;
        client_paid: boolean;
        client_amount_received: number;
        driver_paid: boolean;
        driver_amount_paid: number;
        dispatcher_paid: boolean;
        dispatcher_fee_amount: number;
      }[]
    | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: new URL(request.url).pathname,
    route: "/api/loads/export",
    kind: "api",
  });
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const status = searchParams.get("status");
  const broker = searchParams.get("broker");
  const driver = searchParams.get("driver");
  const paymentFilter = searchParams.get("payment");
  let scope;
  try {
    scope = await resolveExportFleetScope(supabase, searchParams.get("fleet"));
  } catch {
    return NextResponse.json({ error: "Could not validate fleet." }, { status: 500 });
  }
  if (!scope) return NextResponse.json({ error: "Unknown fleet." }, { status: 400 });
  const q = searchParams.get("q");

  let query = supabase
    .from("loads")
    .select("load_number, status, pickup_location, pickup_date, delivery_location, delivery_date, is_round_trip, return_location, round_trip_details, load_rate, driver_pay, dispatcher_fee, fuel_cost, factoring_mode, factoring_percent, factoring_fixed_amount, factoring_amount, load_deductions(label, amount, position), carrier_company, fleet_company, truck_number, trailer_number, notes, brokers(company_name, contact_name), drivers(name), payments(invoice_sent, client_paid, client_amount_received, driver_paid, driver_amount_paid, dispatcher_paid, dispatcher_fee_amount)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as LoadStatus);
  if (broker) query = query.eq("broker_id", broker);
  if (driver) query = query.eq("driver_id", driver);
  query = applyFleetScope(query, scope);
  for (const token of searchTokens(q)) {
    query = query.or(ilikeOr(LOAD_SEARCH_COLUMNS, token));
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Could not export loads." }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ExportLoad[];
  const filteredRows = rows.filter((load) => {
    const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
    const paid = isClientPaymentPaid(load.load_rate, payment);
    if (paymentFilter === "paid") return paid;
    if (paymentFilter === "unpaid") return !paid && load.status !== "Cancelled";
    return true;
  });
  const headers = [
    "Load Number",
    "Status",
    "Broker",
    "Broker Contact",
    "Carrier",
    "Fleet",
    "Driver",
    "Truck",
    "Trailer",
    "Pickup Location",
    "Pickup Date",
    "Delivery Location",
    "Delivery Date",
    "Round Trip",
    "Return Location",
    "Round Trip Details",
    "Load Rate Total",
    "Driver Pay",
    "Dispatcher Fee",
    "Fuel Cost",
    "Factoring Type",
    "Factoring Input",
    "Factoring Amount",
    "Other Deductions",
    "Deduction Details",
    "Total Deductions",
    "Profit",
    "Invoice Sent",
    "Client Collected",
    "Client Outstanding",
    "Client Paid",
    "Driver Paid",
    "Dispatcher Paid",
    "Notes",
  ];

  const csv = [
    csvRow(headers),
    ...filteredRows.map((load) => {
      const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
      const outstanding = load.status === "Cancelled" ? 0 : clientOutstanding(load.load_rate, payment);
      const customDeductions = [...load.load_deductions].sort((a, b) => a.position - b.position);
      const otherDeductions = deductionsTotal(customDeductions);
      const deductionDetails = customDeductions
        .map((deduction) => `${deduction.label}: ${Number(deduction.amount).toFixed(2)}`)
        .join("; ");

      return csvRow([
        load.load_number,
        load.status,
        load.brokers?.company_name,
        load.brokers?.contact_name,
        load.carrier_company,
        load.fleet_company ?? "Unassigned",
        load.drivers?.name,
        load.truck_number,
        load.trailer_number,
        load.pickup_location,
        load.pickup_date,
        load.delivery_location,
        load.delivery_date,
        load.is_round_trip,
        load.return_location,
        load.round_trip_details,
        load.load_rate,
        load.driver_pay,
        load.dispatcher_fee,
        load.fuel_cost,
        load.factoring_mode === "amount" ? "Fixed amount" : "Percentage",
        load.factoring_mode === "amount" ? load.factoring_fixed_amount : `${load.factoring_percent}%`,
        load.factoring_amount,
        otherDeductions,
        deductionDetails,
        totalDeductionsForLoad(load),
        profitForLoad(load),
        Boolean(payment?.invoice_sent),
        clientCollected(load.load_rate, payment),
        outstanding,
        Boolean(payment?.client_paid),
        Boolean(payment?.driver_paid),
        Boolean(payment?.dispatcher_paid),
        load.notes,
      ]);
    }),
  ].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispatchdesk-loads-${fleetScopeSlug(scope)}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

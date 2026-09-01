import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import { clientCollected, clientOutstanding, deductionsTotal, financialCompleteness, isClientPaymentPaid, profitForLoad, totalDeductionsForLoad } from "@/lib/financials";
import { ilikeOr, searchTokens } from "@/lib/search";
import type { LoadCloseoutStatus, LoadStatus } from "@/types/database";
import { applyFleetScope, fleetScopeSlug, resolveExportFleetScope } from "@/lib/fleet-scope";
import { formatStopWindow, type DispatchStop } from "@/lib/dispatch";
import { closeoutReason } from "@/lib/load-lifecycle";

const LOAD_SEARCH_COLUMNS = ["load_number", "pickup_location", "delivery_location", "return_location", "carrier_company", "fleet_company", "truck_number", "trailer_number", "commodity", "special_instructions"];
const STOP_SEARCH_COLUMNS = ["location", "appointment_number", "reference_number", "instructions"];

type ExportLoad = {
  load_number: string;
  status: LoadStatus;
  post_delivery_status: LoadCloseoutStatus | null;
  documents_complete_at: string | null;
  closed_at: string | null;
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
  driver_pay_known: boolean;
  dispatcher_fee_known: boolean;
  fuel_cost_known: boolean;
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
  commodity: string | null;
  weight_lbs: number | null;
  pallet_count: number | null;
  special_instructions: string | null;
  load_stops: DispatchStop[];
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
  const closeout = searchParams.get("closeout");
  const broker = searchParams.get("broker");
  const driver = searchParams.get("driver");
  const paymentFilter = searchParams.get("payment");
  const financialFilter = searchParams.get("financial");
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
    .select("load_number, status, post_delivery_status, documents_complete_at, closed_at, pickup_location, pickup_date, delivery_location, delivery_date, is_round_trip, return_location, round_trip_details, commodity, weight_lbs, pallet_count, special_instructions, load_stops(*), load_rate, driver_pay, dispatcher_fee, fuel_cost, driver_pay_known, dispatcher_fee_known, fuel_cost_known, factoring_mode, factoring_percent, factoring_fixed_amount, factoring_amount, load_deductions(label, amount, position), carrier_company, fleet_company, truck_number, trailer_number, notes, brokers(company_name, contact_name), drivers(name), payments(invoice_sent, client_paid, client_amount_received, driver_paid, driver_amount_paid, dispatcher_paid, dispatcher_fee_amount)")
    .order("created_at", { ascending: false });

  if (status && !closeout) query = query.eq("status", status as LoadStatus);
  if (broker) query = query.eq("broker_id", broker);
  if (driver) query = query.eq("driver_id", driver);
  if (closeout === "all-open") {
    query = query.eq("status", "Delivered").or("post_delivery_status.is.null,post_delivery_status.neq.Closed");
  } else if (closeout) {
    query = query.eq("post_delivery_status", closeout as LoadCloseoutStatus);
  }
  query = applyFleetScope(query, scope);
  for (const token of searchTokens(q)) {
    const stopMatches = await supabase.from("load_stops").select("load_id").or(ilikeOr(STOP_SEARCH_COLUMNS, token));
    if (stopMatches.error) return NextResponse.json({ error: "Could not search structured stops." }, { status: 500 });
    const ids = [...new Set((stopMatches.data ?? []).map((stop) => stop.load_id))];
    query = query.or([ilikeOr(LOAD_SEARCH_COLUMNS, token), ids.length ? `id.in.(${ids.join(",")})` : null].filter(Boolean).join(","));
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Could not export loads." }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ExportLoad[];
  const filteredRows = rows.filter((load) => {
    const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
    const paid = isClientPaymentPaid(load.load_rate, payment);
    const paymentMatches = paymentFilter === "paid" ? paid : paymentFilter === "unpaid" ? !paid && load.status !== "Cancelled" : true;
    const complete = financialCompleteness(load).complete;
    const financialMatches = financialFilter === "complete" ? complete : financialFilter === "incomplete" ? !complete : true;
    return paymentMatches && financialMatches;
  });
  const headers = [
    "Load Number",
    "Status",
    "Post-delivery Stage",
    "Why Not Closed",
    "Documents Complete At",
    "Closed At",
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
    "Commodity",
    "Weight (lb)",
    "Pallets",
    "Special Instructions",
    "Structured Stops",
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
    "Financial Completeness",
    "Missing Financial Fields",
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
      const stopDetails = [...(load.load_stops ?? [])]
        .sort((first, second) => first.position - second.position)
        .map((stop, index) => [
          `${index + 1}. ${stop.stop_type}: ${stop.location}`,
          formatStopWindow(stop),
          stop.appointment_number ? `Appointment ${stop.appointment_number}` : null,
          stop.reference_number ? `Reference ${stop.reference_number}` : null,
          stop.instructions,
        ].filter(Boolean).join(" | "))
        .join("; ");

      return csvRow([
        load.load_number,
        load.status,
        load.post_delivery_status,
        load.post_delivery_status === "Closed" ? "" : closeoutReason(load.post_delivery_status),
        load.documents_complete_at,
        load.closed_at,
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
        load.commodity,
        load.weight_lbs,
        load.pallet_count,
        load.special_instructions,
        stopDetails,
        load.load_rate,
        load.driver_pay_known ? load.driver_pay : "Unknown",
        load.dispatcher_fee_known ? load.dispatcher_fee : "Unknown",
        load.fuel_cost_known ? load.fuel_cost : "Unknown",
        load.factoring_mode === "amount" ? "Fixed amount" : "Percentage",
        load.factoring_mode === "amount" ? load.factoring_fixed_amount : `${load.factoring_percent}%`,
        load.factoring_amount,
        otherDeductions,
        deductionDetails,
        totalDeductionsForLoad(load),
        profitForLoad(load),
        financialCompleteness(load).complete ? "Complete" : "Incomplete",
        financialCompleteness(load).missingLabels.join("; "),
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

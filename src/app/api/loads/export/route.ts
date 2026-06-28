import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import { clientCollected, clientOutstanding, profitForLoad } from "@/lib/financials";
import { ilikeOr, searchTokens } from "@/lib/search";
import type { LoadStatus } from "@/types/database";

const LOAD_SEARCH_COLUMNS = ["load_number", "pickup_location", "delivery_location", "carrier_company"];

type ExportLoad = {
  load_number: string;
  status: LoadStatus;
  pickup_location: string;
  pickup_date: string | null;
  delivery_location: string;
  delivery_date: string | null;
  is_round_trip: boolean;
  round_trip_details: string | null;
  load_rate: number;
  driver_pay: number;
  dispatcher_fee: number;
  fuel_cost: number;
  carrier_company: string | null;
  notes: string | null;
  brokers: { company_name: string | null; contact_name: string | null } | null;
  drivers: { name: string | null; truck_number: string | null; trailer_number: string | null } | null;
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
  let query = supabase
    .from("loads")
    .select("load_number, status, pickup_location, pickup_date, delivery_location, delivery_date, is_round_trip, round_trip_details, load_rate, driver_pay, dispatcher_fee, fuel_cost, carrier_company, notes, brokers(company_name, contact_name), drivers(name, truck_number, trailer_number), payments(invoice_sent, client_paid, client_amount_received, driver_paid, driver_amount_paid, dispatcher_paid, dispatcher_fee_amount)")
    .order("created_at", { ascending: false });

  const status = searchParams.get("status");
  const broker = searchParams.get("broker");
  const driver = searchParams.get("driver");
  const q = searchParams.get("q");

  if (status) query = query.eq("status", status as LoadStatus);
  if (broker) query = query.eq("broker_id", broker);
  if (driver) query = query.eq("driver_id", driver);
  for (const token of searchTokens(q)) {
    query = query.or(ilikeOr(LOAD_SEARCH_COLUMNS, token));
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Could not export loads." }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ExportLoad[];
  const headers = [
    "Load Number",
    "Status",
    "Broker",
    "Broker Contact",
    "Carrier",
    "Driver",
    "Truck",
    "Trailer",
    "Pickup Location",
    "Pickup Date",
    "Delivery Location",
    "Delivery Date",
    "Round Trip",
    "Round Trip Details",
    "Load Rate Total",
    "Driver Pay",
    "Dispatcher Fee",
    "Fuel Cost",
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
    ...rows.map((load) => {
      const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
      const outstanding = load.status === "Cancelled" ? 0 : clientOutstanding(load.load_rate, payment);

      return csvRow([
        load.load_number,
        load.status,
        load.brokers?.company_name,
        load.brokers?.contact_name,
        load.carrier_company,
        load.drivers?.name,
        load.drivers?.truck_number,
        load.drivers?.trailer_number,
        load.pickup_location,
        load.pickup_date,
        load.delivery_location,
        load.delivery_date,
        load.is_round_trip,
        load.round_trip_details,
        load.load_rate,
        load.driver_pay,
        load.dispatcher_fee,
        load.fuel_cost,
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
      "Content-Disposition": `attachment; filename="dispatchdesk-loads-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import {
  currentIftaQuarter,
  iftaStateName,
  iftaTotals,
  quarterDateRange,
  statesWithMiles,
  summarizeIftaByState,
  tripTotalMiles,
  type IftaQuarter,
  type IftaStateMilesEntry,
} from "@/lib/ifta";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";

const REPORTS = ["summary", "trips", "fuel"] as const;
type Report = (typeof REPORTS)[number];

type ExportTrip = {
  truck_number: string;
  start_date: string;
  end_date: string | null;
  pickup_city: string;
  dropoff_city: string;
  notes: string | null;
  ifta_trip_miles: IftaStateMilesEntry[];
};

type ExportFuelPurchase = {
  truck_number: string;
  purchase_date: string;
  city: string | null;
  state: string;
  gallons: number;
  amount_paid: number;
  notes: string | null;
};

function selectedQuarter(searchParams: URLSearchParams): IftaQuarter {
  const fallback = currentIftaQuarter();
  const year = Number(searchParams.get("year"));
  const quarter = Number(searchParams.get("quarter"));
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback.year,
    quarter: [1, 2, 3, 4].includes(quarter) ? (quarter as IftaQuarter["quarter"]) : fallback.quarter,
  };
}

function summaryCsv(trips: ExportTrip[], purchases: ExportFuelPurchase[]) {
  const summary = summarizeIftaByState(trips, purchases);
  const totals = iftaTotals(summary);
  return [
    csvRow(["State", "State Name", "Miles", "Gallons Purchased", "Fuel Paid"]),
    ...summary.map((state) => csvRow([state.state, iftaStateName(state.state), state.miles, state.gallons, state.paid.toFixed(2)])),
    csvRow(["TOTAL", "", totals.miles, totals.gallons, totals.paid.toFixed(2)]),
  ].join("\n");
}

function tripsCsv(trips: ExportTrip[]) {
  const states = statesWithMiles(trips);
  const stateMiles = (trip: ExportTrip, state: string) =>
    trip.ifta_trip_miles.find((leg) => leg.state === state)?.miles ?? "";
  return [
    csvRow(["Truck", "Start Date", "End Date", "Pickup City", "Drop-off City", ...states.map((state) => `${state} Miles`), "Total Miles", "Notes"]),
    ...trips.map((trip) => csvRow([
      trip.truck_number,
      trip.start_date,
      trip.end_date,
      trip.pickup_city,
      trip.dropoff_city,
      ...states.map((state) => stateMiles(trip, state)),
      tripTotalMiles(trip.ifta_trip_miles),
      trip.notes,
    ])),
  ].join("\n");
}

function fuelCsv(purchases: ExportFuelPurchase[]) {
  return [
    csvRow(["Truck", "Purchase Date", "City", "State", "Gallons", "Amount Paid", "Notes"]),
    ...purchases.map((purchase) => csvRow([
      purchase.truck_number,
      purchase.purchase_date,
      purchase.city,
      purchase.state,
      purchase.gallons,
      Number(purchase.amount_paid).toFixed(2),
      purchase.notes,
    ])),
  ].join("\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: url.pathname,
    route: "/api/ifta/export",
    kind: "api",
  });
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { searchParams } = url;
  const report = searchParams.get("report");
  if (!REPORTS.includes(report as Report)) {
    return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  }

  const period = selectedQuarter(searchParams);
  const { start, end } = quarterDateRange(period);
  const truck = searchParams.get("truck");

  let tripsQuery = supabase
    .from("ifta_trips")
    .select("truck_number, start_date, end_date, pickup_city, dropoff_city, notes, ifta_trip_miles(state, miles)")
    .gte("start_date", start)
    .lte("start_date", end)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (truck) tripsQuery = tripsQuery.eq("truck_number", truck);

  let fuelQuery = supabase
    .from("ifta_fuel_purchases")
    .select("truck_number, purchase_date, city, state, gallons, amount_paid, notes")
    .gte("purchase_date", start)
    .lte("purchase_date", end)
    .order("purchase_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (truck) fuelQuery = fuelQuery.eq("truck_number", truck);

  const [trips, purchases] = await Promise.all([
    report === "fuel" ? Promise.resolve({ data: [], error: null }) : tripsQuery,
    report === "trips" ? Promise.resolve({ data: [], error: null }) : fuelQuery,
  ]);
  if (trips.error || purchases.error) {
    return NextResponse.json({ error: "Could not export IFTA report." }, { status: 500 });
  }

  const tripRows = (trips.data ?? []) as unknown as ExportTrip[];
  const fuelRows = (purchases.data ?? []) as unknown as ExportFuelPurchase[];
  const csv =
    report === "summary" ? summaryCsv(tripRows, fuelRows)
    : report === "trips" ? tripsCsv(tripRows)
    : fuelCsv(fuelRows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispatchdesk-ifta-${report}-${period.year}-Q${period.quarter}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

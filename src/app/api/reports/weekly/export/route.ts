import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";

const PERIODS: WeeklyFinancialPeriod[] = ["this", "last", "all", "custom"];

function normalizePeriod(value: string | null): WeeklyFinancialPeriod {
  return PERIODS.includes(value as WeeklyFinancialPeriod) ? (value as WeeklyFinancialPeriod) : "all";
}

function filenameDate(value: string | null) {
  return value ?? "open";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: url.pathname,
    route: "/api/reports/weekly/export",
    kind: "api",
  });
  if ("response" in auth) return auth.response;

  const { searchParams } = url;
  const { summaries, range } = await getWeeklyDriverFinancialSummary({
    period: normalizePeriod(searchParams.get("period")),
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    driver: searchParams.get("driver") ?? undefined,
    fleet: searchParams.get("fleet") ?? undefined,
  });

  const headers = [
    "Week Start",
    "Week End",
    "Driver",
    "Load Count",
    "Load Number",
    "Load Date",
    "Status",
    "Round Trip",
    "Return Location",
    "Round Trip Details",
    "Load Rate Total",
    "Driver Pay",
    "Dispatcher Fee",
    "Fuel Cost",
    "Estimated Profit",
    "Weekly Load Rate Total",
    "Weekly Driver Pay Total",
    "Weekly Dispatcher Fee Total",
    "Weekly Fuel Cost Total",
    "Weekly Estimated Profit Total",
  ];

  const rows = summaries.flatMap((summary) =>
    summary.loads.map((load) =>
      csvRow([
        summary.weekStart,
        summary.weekEnd,
        summary.driverName,
        summary.loadCount,
        load.loadNumber,
        load.date,
        load.status,
        load.isRoundTrip,
        load.returnLocation,
        load.roundTripDetails,
        load.loadRate,
        load.driverPay,
        load.dispatcherFee,
        load.fuelCost,
        load.estimatedProfit,
        summary.loadRateTotal,
        summary.driverPayTotal,
        summary.dispatcherFeeTotal,
        summary.fuelCostTotal,
        summary.estimatedProfitTotal,
      ]),
    ),
  );

  const csv = [csvRow(headers), ...rows].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  const rangeLabel = `${filenameDate(range.from)}-to-${filenameDate(range.to)}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispatchdesk-weekly-report-${rangeLabel}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

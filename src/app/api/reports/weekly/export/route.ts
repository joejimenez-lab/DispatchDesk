import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import { fleetScopeSlug, resolveExportFleetScope } from "@/lib/fleet-scope";

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
  let scope;
  try {
    scope = await resolveExportFleetScope(auth.supabase, searchParams.get("fleet"));
  } catch {
    return NextResponse.json({ error: "Could not validate fleet." }, { status: 500 });
  }
  if (!scope) return NextResponse.json({ error: "Unknown fleet." }, { status: 400 });
  const { summaries, range } = await getWeeklyDriverFinancialSummary({
    period: normalizePeriod(searchParams.get("period")),
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    driver: searchParams.get("driver") ?? undefined,
    fleetScope: scope,
  });

  const headers = [
    "Week Start",
    "Week End",
    "Driver",
    "Fleet",
    "Load Count",
    "Load Number",
    "Load Date",
    "Status",
    "Post-delivery Stage",
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
    "Estimated Profit",
    "Weekly Load Rate Total",
    "Weekly Driver Pay Total",
    "Weekly Dispatcher Fee Total",
    "Weekly Fuel Cost Total",
    "Weekly Factoring Total",
    "Weekly Other Deduction Total",
    "Weekly Total Deductions",
    "Weekly Estimated Profit Total",
  ];

  const rows = summaries.flatMap((summary) =>
    summary.loads.map((load) =>
      csvRow([
        summary.weekStart,
        summary.weekEnd,
        summary.driverName,
        load.fleetCompany ?? "Unassigned",
        summary.loadCount,
        load.loadNumber,
        load.date,
        load.status,
        load.postDeliveryStatus,
        load.isRoundTrip,
        load.returnLocation,
        load.roundTripDetails,
        load.loadRate,
        load.driverPay,
        load.dispatcherFee,
        load.fuelCost,
        load.factoringMode === "amount" ? "Fixed amount" : "Percentage",
        load.factoringMode === "amount" ? load.factoringFixedAmount : `${load.factoringPercent}%`,
        load.factoringAmount,
        load.otherDeductionTotal,
        load.otherDeductions.map((deduction) => `${deduction.label}: ${deduction.amount.toFixed(2)}`).join("; "),
        load.totalDeductions,
        load.estimatedProfit,
        summary.loadRateTotal,
        summary.driverPayTotal,
        summary.dispatcherFeeTotal,
        summary.fuelCostTotal,
        summary.factoringTotal,
        summary.otherDeductionTotal,
        summary.totalDeductionsTotal,
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
      "Content-Disposition": `attachment; filename="dispatchdesk-weekly-report-${fleetScopeSlug(scope)}-${rangeLabel}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

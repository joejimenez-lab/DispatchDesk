import { NextResponse } from "next/server";
import {
  bookkeepingCsv,
  bookkeepingSummaryCsv,
  summarizeBookkeepingRows,
} from "@/lib/bookkeeping";
import { renderBusinessReportPdf } from "@/lib/business-report-pdf";
import {
  bookkeepingExpenseMatchesFleet,
  bookkeepingExpenseToExportRows,
  normalizeExpenseCategory,
  type BookkeepingExpense,
} from "@/lib/data/bookkeeping";
import { getFleetTruckNumbers } from "@/lib/data/fleet";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: string | null) {
  return value && isoDatePattern.test(value) ? value : null;
}

function validUuid(value: string | null) {
  return value && uuidPattern.test(value) ? value : null;
}

const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function filterLabel(filters: { from: string | null; to: string | null; category: string | null; fleet: string | null }) {
  const date = filters.from && filters.to
    ? `${filters.from} through ${filters.to}`
    : filters.from
      ? `From ${filters.from}`
      : filters.to
        ? `Through ${filters.to}`
        : "All available dates";
  return [date, filters.category ? `Category: ${filters.category}` : null, filters.fleet ? `Fleet: ${filters.fleet}` : null]
    .filter(Boolean)
    .join(" · ");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: url.pathname,
    route: "/api/bookkeeping/export",
    kind: "api",
  });
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { searchParams } = url;
  const format = searchParams.get("format") ?? "csv";
  const view = searchParams.get("view") ?? "detailed";
  if (!(["csv", "pdf"] as const).includes(format as "csv" | "pdf") || !(["summary", "detailed"] as const).includes(view as "summary" | "detailed")) {
    return NextResponse.json({ error: "Choose a valid export format and view." }, { status: 400 });
  }
  const category = normalizeExpenseCategory(searchParams.get("category") ?? undefined);
  const from = validDate(searchParams.get("from"));
  const to = validDate(searchParams.get("to"));
  const unit = validUuid(searchParams.get("unit"));
  const load = validUuid(searchParams.get("load"));
  const driver = validUuid(searchParams.get("driver"));
  const fleet = searchParams.get("fleet")?.trim() || null;
  const fleetTruckNumbers = fleet ? new Set(await getFleetTruckNumbers(fleet)) : null;

  let query = supabase
    .from("bookkeeping_expense_groups")
    .select(`
      *,
      bookkeeping_expenses(*),
      bookkeeping_receipts(*),
      fleet_units(id, unit_number, unit_type, company),
      loads(id, load_number, pickup_location, delivery_location, drivers(truck_number)),
      drivers(id, name, truck_number),
      service_records(id, service_date, description, fleet_units(id, unit_number, unit_type, company)),
      inspection_records(id, inspection_date, result, fleet_units(id, unit_number, unit_type, company)),
      repair_logs(id, repair_date, description, log_type, fleet_units(id, unit_number, unit_type, company)),
      ifta_fuel_purchases(id, purchase_date, state, city, gallons, truck_number)
    `)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  if (unit) query = query.eq("unit_id", unit);
  if (load) query = query.eq("load_id", load);
  if (driver) query = query.eq("driver_id", driver);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not export bookkeeping expenses." }, { status: 500 });

  const rows = ((data ?? []) as unknown as BookkeepingExpense[])
    .filter((expense) => !fleet || !fleetTruckNumbers || bookkeepingExpenseMatchesFleet(expense, fleet, fleetTruckNumbers))
    .filter((expense) => !category || expense.bookkeeping_expenses.some((line) => line.category === category))
    .flatMap((expense) => bookkeepingExpenseToExportRows(expense, category));
  const stamp = new Date().toISOString().slice(0, 10);
  const baseFilename = `dispatchdesk-bookkeeping-${view}-${stamp}`;

  if (format === "pdf") {
    const summaryRows = summarizeBookkeepingRows(rows);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const receiptCount = rows.reduce((sum, row) => sum + row.receiptCount, 0);
    const pdf = await renderBusinessReportPdf(view === "summary" ? {
      title: "Bookkeeping Summary",
      subtitle: filterLabel({ from, to, category, fleet }),
      metrics: [
        { label: "Categories", value: String(summaryRows.length) },
        { label: "Expense lines", value: String(rows.length) },
        { label: "Receipts", value: String(receiptCount) },
        { label: "Total", value: moneyFormatter.format(total) },
      ],
      columns: [
        { label: "Category", width: "45%" },
        { label: "Expense lines", width: "18%", align: "right" },
        { label: "Receipts", width: "17%", align: "right" },
        { label: "Total", width: "20%", align: "right" },
      ],
      rows: summaryRows.map((row) => [row.category, String(row.expenseLines), String(row.receiptCount), moneyFormatter.format(row.total)]),
      emptyMessage: "No bookkeeping expenses match the selected filters.",
    } : {
      title: "Detailed Bookkeeping Expenses",
      subtitle: filterLabel({ from, to, category, fleet }),
      metrics: [
        { label: "Expense lines", value: String(rows.length) },
        { label: "Receipts", value: String(receiptCount) },
        { label: "Total", value: moneyFormatter.format(total) },
      ],
      columns: [
        { label: "Date", width: "10%" },
        { label: "Category", width: "12%" },
        { label: "Vendor", width: "18%" },
        { label: "Unit", width: "14%" },
        { label: "Load / Driver", width: "16%" },
        { label: "Receipt files", width: "20%" },
        { label: "Amount", width: "10%", align: "right" },
      ],
      rows: rows.map((row) => [
        row.expenseDate,
        row.category,
        row.vendor ?? "",
        row.unit ?? "",
        [row.loadNumber, row.driver].filter(Boolean).join(" / "),
        row.receiptFiles,
        moneyFormatter.format(row.amount),
      ]),
      emptyMessage: "No bookkeeping expenses match the selected filters.",
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const csv = view === "summary" ? bookkeepingSummaryCsv(rows) : bookkeepingCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseFilename}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { bookkeepingCsv } from "@/lib/bookkeeping";
import {
  bookkeepingExpenseToExportRow,
  normalizeExpenseCategory,
  type BookkeepingExpense,
} from "@/lib/data/bookkeeping";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: string | null) {
  return value && isoDatePattern.test(value) ? value : null;
}

function validUuid(value: string | null) {
  return value && uuidPattern.test(value) ? value : null;
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
  const category = normalizeExpenseCategory(searchParams.get("category") ?? undefined);
  const from = validDate(searchParams.get("from"));
  const to = validDate(searchParams.get("to"));
  const unit = validUuid(searchParams.get("unit"));
  const load = validUuid(searchParams.get("load"));
  const driver = validUuid(searchParams.get("driver"));

  let query = supabase
    .from("bookkeeping_expenses")
    .select(`
      *,
      bookkeeping_receipts(*),
      fleet_units(id, unit_number, unit_type, company),
      loads(id, load_number, pickup_location, delivery_location),
      drivers(id, name),
      service_records(id, service_date, description, fleet_units(id, unit_number, unit_type, company)),
      inspection_records(id, inspection_date, result, fleet_units(id, unit_number, unit_type, company)),
      repair_logs(id, repair_date, description, log_type, fleet_units(id, unit_number, unit_type, company))
    `)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  if (unit) query = query.eq("unit_id", unit);
  if (load) query = query.eq("load_id", load);
  if (driver) query = query.eq("driver_id", driver);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not export bookkeeping expenses." }, { status: 500 });

  const csv = bookkeepingCsv(
    ((data ?? []) as unknown as BookkeepingExpense[]).map(bookkeepingExpenseToExportRow),
  );
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispatchdesk-bookkeeping-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

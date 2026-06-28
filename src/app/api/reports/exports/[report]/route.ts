import { NextResponse } from "next/server";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";
import { clientOutstanding } from "@/lib/financials";
import {
  clientBillingCsv,
  maintenanceCsv,
  type MaintenanceExportRow,
  weeklyFinancialCsv,
  weeklyPayrollCsv,
  yearlyFinancialCsv,
} from "@/lib/report-exports";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";

const PERIODS: WeeklyFinancialPeriod[] = ["this", "last", "all", "custom"];
const REPORTS = ["weekly-payroll", "weekly-financial", "client-billing", "maintenance", "yearly-financial"] as const;
type Report = (typeof REPORTS)[number];

function normalizePeriod(value: string | null): WeeklyFinancialPeriod {
  return PERIODS.includes(value as WeeklyFinancialPeriod) ? (value as WeeklyFinancialPeriod) : "all";
}

function download(csv: string, report: Report) {
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispatchdesk-${report}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

type Unit = { unit_number: string; unit_type: string; company: string | null } | null;

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const url = new URL(request.url);
  const auth = await createAuthenticatedRouteClient({
    method: request.method,
    path: url.pathname,
    route: "/api/reports/exports/[report]",
    kind: "api",
  });
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  const { report: rawReport } = await params;
  if (!REPORTS.includes(rawReport as Report)) {
    return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  }
  const report = rawReport as Report;
  const { searchParams } = url;

  try {
    if (report === "weekly-payroll" || report === "weekly-financial") {
      const { summaries } = await getWeeklyDriverFinancialSummary({
        period: normalizePeriod(searchParams.get("period")),
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        driver: searchParams.get("driver") ?? undefined,
      });
      return download(report === "weekly-payroll" ? weeklyPayrollCsv(summaries) : weeklyFinancialCsv(summaries), report);
    }

    if (report === "yearly-financial") {
      const { summaries } = await getWeeklyDriverFinancialSummary({ period: "all" });
      return download(yearlyFinancialCsv(summaries), report);
    }

    if (report === "client-billing") {
      const { data, error } = await supabase
        .from("loads")
        .select("load_number, status, pickup_date, delivery_date, created_at, load_rate, brokers(company_name), payments(invoice_sent, invoice_sent_date, client_paid, client_amount_received, client_date_received)")
        .neq("status", "Cancelled")
        .order("delivery_date", { ascending: false, nullsFirst: false })
        .order("pickup_date", { ascending: false, nullsFirst: false });
      if (error) throw error;

      const csv = clientBillingCsv(((data ?? []) as unknown as {
        load_number: string;
        status: string;
        pickup_date: string | null;
        delivery_date: string | null;
        created_at: string;
        load_rate: number;
        brokers: { company_name: string | null } | null;
        payments: { invoice_sent: boolean; invoice_sent_date: string | null; client_paid: boolean; client_amount_received: number; client_date_received: string | null } | null;
      }[]).map((load) => ({
        loadNumber: load.load_number,
        loadDate: load.delivery_date ?? load.pickup_date ?? load.created_at.slice(0, 10),
        broker: load.brokers?.company_name ?? null,
        status: load.status,
        loadRate: Number(load.load_rate),
        invoiceSent: Boolean(load.payments?.invoice_sent),
        invoiceSentDate: load.payments?.invoice_sent_date ?? null,
        clientPaid: Boolean(load.payments?.client_paid),
        amountReceived: Number(load.payments?.client_amount_received ?? 0),
        dateReceived: load.payments?.client_date_received ?? null,
        outstanding: clientOutstanding(load.load_rate, load.payments),
      })));
      return download(csv, report);
    }

    const [services, inspections, repairs, reminders] = await Promise.all([
      supabase.from("service_records").select("service_date, odometer, description, cost, notes, created_at, fleet_units(unit_number, unit_type, company)"),
      supabase.from("inspection_records").select("inspection_date, odometer, inspector, result, notes, created_at, fleet_units(unit_number, unit_type, company)"),
      supabase.from("repair_logs").select("repair_date, odometer, description, log_type, cost, notes, created_at, fleet_units(unit_number, unit_type, company)"),
      supabase.from("maintenance_reminders").select("reminder_type, due_date, due_odometer, completed_at, notes, fleet_units(unit_number, unit_type, company)"),
    ]);
    for (const result of [services, inspections, repairs, reminders]) if (result.error) throw result.error;

    const unitFields = (unit: Unit) => ({ unitNumber: unit?.unit_number ?? "Unknown", unitType: unit?.unit_type ?? "", company: unit?.company ?? null });
    const rows: MaintenanceExportRow[] = [
      ...((services.data ?? []) as unknown as { service_date: string | null; odometer: number | null; description: string; cost: number; notes: string | null; created_at: string; fleet_units: Unit }[]).map((row) => ({
        ...unitFields(row.fleet_units), recordType: "Service", date: row.service_date ?? row.created_at.slice(0, 10), odometer: row.odometer, description: row.description, result: null, cost: Number(row.cost), status: "Completed", notes: row.notes,
      })),
      ...((inspections.data ?? []) as unknown as { inspection_date: string | null; odometer: number | null; inspector: string | null; result: string | null; notes: string | null; created_at: string; fleet_units: Unit }[]).map((row) => ({
        ...unitFields(row.fleet_units), recordType: "Inspection", date: row.inspection_date ?? row.created_at.slice(0, 10), odometer: row.odometer, description: row.inspector ? `Inspector: ${row.inspector}` : "Inspection", result: row.result, cost: null, status: "Completed", notes: row.notes,
      })),
      ...((repairs.data ?? []) as unknown as { repair_date: string | null; odometer: number | null; description: string; log_type: string; cost: number; notes: string | null; created_at: string; fleet_units: Unit }[]).map((row) => ({
        ...unitFields(row.fleet_units), recordType: row.log_type, date: row.repair_date ?? row.created_at.slice(0, 10), odometer: row.odometer, description: row.description, result: null, cost: Number(row.cost), status: "Completed", notes: row.notes,
      })),
      ...((reminders.data ?? []) as unknown as { reminder_type: string; due_date: string | null; due_odometer: number | null; completed_at: string | null; notes: string | null; fleet_units: Unit }[]).map((row) => ({
        ...unitFields(row.fleet_units), recordType: "Reminder", date: row.due_date, odometer: row.due_odometer, description: row.reminder_type, result: null, cost: null, status: row.completed_at ? "Completed" : "Open", notes: row.notes,
      })),
    ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.unitNumber.localeCompare(b.unitNumber));

    return download(maintenanceCsv(rows), report);
  } catch {
    return NextResponse.json({ error: "Could not export report." }, { status: 500 });
  }
}

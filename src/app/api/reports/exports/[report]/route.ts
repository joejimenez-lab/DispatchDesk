import { NextResponse } from "next/server";
import { renderBusinessReportPdf, type BusinessReportPdfData } from "@/lib/business-report-pdf";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";
import { clientOutstanding } from "@/lib/financials";
import {
  clientBillingCsv,
  maintenanceCsv,
  type BillingRow,
  type MaintenanceExportRow,
  weeklyFinancialCsv,
  weeklyPayrollCsv,
  yearlyFinancialCsv,
  yearlyFinancialRows,
} from "@/lib/report-exports";
import { createAuthenticatedRouteClient } from "@/lib/supabase/route-auth";
import { applyFleetScope, fleetScopeLabel, fleetScopeSlug, matchesFleetScope, resolveExportFleetScope, type FleetScope } from "@/lib/fleet-scope";

export const runtime = "nodejs";

const PERIODS: WeeklyFinancialPeriod[] = ["this", "last", "all", "custom"];
const REPORTS = ["weekly-payroll", "weekly-financial", "client-billing", "maintenance", "yearly-financial"] as const;
type Report = (typeof REPORTS)[number];

function normalizePeriod(value: string | null): WeeklyFinancialPeriod {
  return PERIODS.includes(value as WeeklyFinancialPeriod) ? (value as WeeklyFinancialPeriod) : "all";
}

function csvDownload(csv: string, report: Report, scope: FleetScope) {
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dispatchdesk-${report}-${fleetScopeSlug(scope)}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function pdfDownload(data: BusinessReportPdfData, report: Report, scope: FleetScope) {
  const stamp = new Date().toISOString().slice(0, 10);
  const pdf = await renderBusinessReportPdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dispatchdesk-${report}-${fleetScopeSlug(scope)}-${stamp}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const moneyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function money(value: number) {
  return moneyFormatter.format(value);
}

function selectedRange(searchParams: URLSearchParams) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("from") ?? "") ? searchParams.get("from") : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("to") ?? "") ? searchParams.get("to") : null;
  return { from, to };
}

function filterLabel({ from, to, fleet }: { from: string | null; to: string | null; fleet: string }) {
  const date = from && to ? `${from} through ${to}` : from ? `From ${from}` : to ? `Through ${to}` : "All available dates";
  return `${date} · Fleet: ${fleet}`;
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
  const format = searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "pdf") {
    return NextResponse.json({ error: "Choose CSV or PDF format." }, { status: 400 });
  }
  let scope;
  try {
    scope = await resolveExportFleetScope(supabase, searchParams.get("fleet"));
  } catch {
    return NextResponse.json({ error: "Could not validate fleet." }, { status: 500 });
  }
  if (!scope) return NextResponse.json({ error: "Unknown fleet." }, { status: 400 });
  const fleet = fleetScopeLabel(scope);
  const range = selectedRange(searchParams);

  try {
    if (report === "weekly-payroll" || report === "weekly-financial") {
      const { summaries, range: effectiveRange } = await getWeeklyDriverFinancialSummary({
        period: normalizePeriod(searchParams.get("period")),
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        driver: searchParams.get("driver") ?? undefined,
        fleetScope: scope,
      });
      if (format === "csv") {
        return csvDownload(report === "weekly-payroll" ? weeklyPayrollCsv(summaries) : weeklyFinancialCsv(summaries), report, scope);
      }

      const totals = summaries.reduce((total, summary) => ({
        loads: total.loads + summary.loadCount,
        revenue: total.revenue + summary.loadRateTotal,
        pay: total.pay + summary.driverPayTotal,
        factoring: total.factoring + summary.factoringTotal,
        otherDeductions: total.otherDeductions + summary.otherDeductionTotal,
        profit: total.profit + summary.estimatedProfitTotal,
      }), { loads: 0, revenue: 0, pay: 0, factoring: 0, otherDeductions: 0, profit: 0 });
      const subtitle = filterLabel({ ...effectiveRange, fleet });

      return pdfDownload(report === "weekly-payroll" ? {
        title: "Weekly Driver Payroll",
        subtitle,
        metrics: [
          { label: "Drivers / weeks", value: String(summaries.length) },
          { label: "Loads", value: String(totals.loads) },
          { label: "Gross driver pay", value: money(totals.pay) },
        ],
        columns: [
          { label: "Fleet", width: "14%" },
          { label: "Week", width: "24%" },
          { label: "Driver", width: "25%" },
          { label: "Loads", width: "12%", align: "right" },
          { label: "Gross pay", width: "25%", align: "right" },
        ],
        rows: summaries.map((summary) => [
          summary.fleetCompany ?? "Unassigned",
          `${summary.weekStart} - ${summary.weekEnd}`,
          summary.driverName,
          String(summary.loadCount),
          money(summary.driverPayTotal),
        ]),
        emptyMessage: "No payroll records match the selected filters.",
      } : {
        title: "Weekly Financial Report",
        subtitle,
        metrics: [
          { label: "Loads", value: String(totals.loads) },
          { label: "Revenue", value: money(totals.revenue) },
          { label: "Driver pay", value: money(totals.pay) },
          { label: "Deductions", value: money(totals.factoring + totals.otherDeductions) },
          { label: "Estimated profit", value: money(totals.profit) },
        ],
        columns: [
          { label: "Fleet", width: "9%" },
          { label: "Week", width: "16%" },
          { label: "Driver", width: "14%" },
          { label: "Loads", width: "7%", align: "right" },
          { label: "Revenue", width: "12%", align: "right" },
          { label: "Driver pay", width: "12%", align: "right" },
          { label: "Factoring", width: "9%", align: "right" },
          { label: "Other ded.", width: "9%", align: "right" },
          { label: "Est. profit", width: "12%", align: "right" },
        ],
        rows: summaries.map((summary) => [
          summary.fleetCompany ?? "Unassigned",
          `${summary.weekStart} - ${summary.weekEnd}`,
          summary.driverName,
          String(summary.loadCount),
          money(summary.loadRateTotal),
          money(summary.driverPayTotal),
          money(summary.factoringTotal),
          money(summary.otherDeductionTotal),
          money(summary.estimatedProfitTotal),
        ]),
        emptyMessage: "No financial records match the selected filters.",
      }, report, scope);
    }

    if (report === "yearly-financial") {
      const period = normalizePeriod(searchParams.get("period"));
      const { summaries, range: effectiveRange } = await getWeeklyDriverFinancialSummary({
        period,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        driver: searchParams.get("driver") ?? undefined,
        fleetScope: scope,
      });
      if (format === "csv") return csvDownload(yearlyFinancialCsv(summaries), report, scope);

      const rows = yearlyFinancialRows(summaries);
      const totals = rows.reduce((total, row) => ({
        loads: total.loads + row.loadCount,
        revenue: total.revenue + row.revenue,
        deductions: total.deductions + row.totalDeductions,
        profit: total.profit + row.profit,
      }), { loads: 0, revenue: 0, deductions: 0, profit: 0 });
      return pdfDownload({
        title: "Yearly Financial Summary",
        subtitle: filterLabel({ ...effectiveRange, fleet }),
        metrics: [
          { label: "Years", value: String(new Set(rows.map((row) => row.year)).size) },
          { label: "Loads", value: String(totals.loads) },
          { label: "Revenue", value: money(totals.revenue) },
          { label: "Deductions", value: money(totals.deductions) },
          { label: "Estimated profit", value: money(totals.profit) },
        ],
        columns: [
          { label: "Fleet", width: "10%" },
          { label: "Year", width: "10%" },
          { label: "Loads", width: "7%", align: "right" },
          { label: "Revenue", width: "13%", align: "right" },
          { label: "Driver pay", width: "13%", align: "right" },
          { label: "Factoring", width: "11%", align: "right" },
          { label: "Other ded.", width: "11%", align: "right" },
          { label: "Other costs", width: "13%", align: "right" },
          { label: "Est. profit", width: "12%", align: "right" },
        ],
        rows: rows.map((row) => [
          row.fleet,
          row.year,
          String(row.loadCount),
          money(row.revenue),
          money(row.driverPay),
          money(row.factoring),
          money(row.otherDeductions),
          money(row.dispatcherFees + row.fuelCost),
          money(row.profit),
        ]),
        emptyMessage: "No yearly financial records match the selected filters.",
      }, report, scope);
    }

    if (report === "client-billing") {
      let query = supabase
        .from("loads")
        .select("load_number, status, post_delivery_status, pickup_date, delivery_date, created_at, load_rate, driver_id, fleet_company, brokers(company_name), payments(invoice_sent, invoice_sent_date, client_paid, client_amount_received, client_date_received)")
        .neq("status", "Cancelled")
        .order("delivery_date", { ascending: false, nullsFirst: false })
        .order("pickup_date", { ascending: false, nullsFirst: false });
      query = applyFleetScope(query, scope);
      const { data, error } = await query;
      if (error) throw error;

      const rows: BillingRow[] = ((data ?? []) as unknown as {
        load_number: string;
        status: string;
        post_delivery_status: string | null;
        pickup_date: string | null;
        delivery_date: string | null;
        created_at: string;
        load_rate: number;
        driver_id: string | null;
        fleet_company: string | null;
        brokers: { company_name: string | null } | null;
        payments: { invoice_sent: boolean; invoice_sent_date: string | null; client_paid: boolean; client_amount_received: number; client_date_received: string | null } | null;
      }[]).filter((load) => {
        const loadDate = load.delivery_date ?? load.pickup_date ?? load.created_at.slice(0, 10);
        if (range.from && loadDate < range.from) return false;
        if (range.to && loadDate > range.to) return false;
        if (searchParams.get("driver") && load.driver_id !== searchParams.get("driver")) return false;
        return true;
      }).map((load) => ({
        fleet: load.fleet_company ?? "Unassigned",
        loadNumber: load.load_number,
        loadDate: load.delivery_date ?? load.pickup_date ?? load.created_at.slice(0, 10),
        broker: load.brokers?.company_name ?? null,
        status: load.status,
        postDeliveryStatus: load.post_delivery_status,
        loadRate: Number(load.load_rate),
        invoiceSent: Boolean(load.payments?.invoice_sent),
        invoiceSentDate: load.payments?.invoice_sent_date ?? null,
        clientPaid: Boolean(load.payments?.client_paid),
        amountReceived: Number(load.payments?.client_amount_received ?? 0),
        dateReceived: load.payments?.client_date_received ?? null,
        outstanding: clientOutstanding(load.load_rate, load.payments),
      }));
      if (format === "csv") return csvDownload(clientBillingCsv(rows), report, scope);

      const totals = rows.reduce((total, row) => ({
        invoiced: total.invoiced + row.loadRate,
        received: total.received + row.amountReceived,
        outstanding: total.outstanding + row.outstanding,
      }), { invoiced: 0, received: 0, outstanding: 0 });
      return pdfDownload({
        title: "Client Billing",
        subtitle: filterLabel({ ...range, fleet }),
        metrics: [
          { label: "Loads", value: String(rows.length) },
          { label: "Invoiced", value: money(totals.invoiced) },
          { label: "Received", value: money(totals.received) },
          { label: "Outstanding", value: money(totals.outstanding) },
        ],
        columns: [
          { label: "Fleet", width: "10%" },
          { label: "Load", width: "11%" },
          { label: "Date", width: "10%" },
          { label: "Client", width: "19%" },
          { label: "Status", width: "12%" },
          { label: "Invoice", width: "12%", align: "right" },
          { label: "Received", width: "12%", align: "right" },
          { label: "Outstanding", width: "14%", align: "right" },
        ],
        rows: rows.map((row) => [row.fleet, row.loadNumber, row.loadDate, row.broker ?? "", [row.status, row.postDeliveryStatus].filter(Boolean).join(" · "), money(row.loadRate), money(row.amountReceived), money(row.outstanding)]),
        emptyMessage: "No client billing records match the selected filters.",
      }, report, scope);
    }

    const [services, inspections, repairs, reminders, bookkeepingExpenses] = await Promise.all([
      supabase.from("service_records").select("service_date, odometer, description, cost, notes, created_at, fleet_units(unit_number, unit_type, company)"),
      supabase.from("inspection_records").select("inspection_date, odometer, inspector, result, notes, created_at, fleet_units(unit_number, unit_type, company)"),
      supabase.from("repair_logs").select("repair_date, odometer, description, log_type, cost, notes, created_at, fleet_units(unit_number, unit_type, company)"),
      supabase.from("maintenance_reminders").select("reminder_type, due_date, due_odometer, completed_at, notes, fleet_units(unit_number, unit_type, company)"),
      supabase
        .from("bookkeeping_expenses")
        .select("expense_date, category, amount, vendor, notes, fleet_units(unit_number, unit_type, company)")
        .or("category.eq.Maintenance,service_record_id.not.is.null,inspection_record_id.not.is.null,repair_log_id.not.is.null"),
    ]);
    for (const result of [services, inspections, repairs, reminders, bookkeepingExpenses]) if (result.error) throw result.error;

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
      ...((bookkeepingExpenses.data ?? []) as unknown as { expense_date: string; category: string; amount: number; vendor: string | null; notes: string | null; fleet_units: Unit }[]).map((row) => ({
        ...unitFields(row.fleet_units), recordType: `Bookkeeping ${row.category}`, date: row.expense_date, odometer: null, description: row.vendor ? `${row.category} - ${row.vendor}` : row.category, result: null, cost: Number(row.amount), status: "Recorded", notes: row.notes,
      })),
    ].filter((row) => matchesFleetScope(row.company, scope))
      .filter((row) => !range.from || Boolean(row.date && row.date >= range.from))
      .filter((row) => !range.to || Boolean(row.date && row.date <= range.to))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.unitNumber.localeCompare(b.unitNumber));

    if (format === "csv") return csvDownload(maintenanceCsv(rows), report, scope);

    const totalCost = rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
    return pdfDownload({
      title: "Maintenance History",
      subtitle: filterLabel({ ...range, fleet }),
      metrics: [
        { label: "Records", value: String(rows.length) },
        { label: "Units", value: String(new Set(rows.map((row) => `${row.company ?? ""}:${row.unitNumber}`)).size) },
        { label: "Recorded cost", value: money(totalCost) },
      ],
      columns: [
        { label: "Fleet", width: "10%" },
        { label: "Date", width: "10%" },
        { label: "Unit", width: "10%" },
        { label: "Type", width: "13%" },
        { label: "Description", width: "27%" },
        { label: "Status / result", width: "16%" },
        { label: "Cost", width: "14%", align: "right" },
      ],
      rows: rows.map((row) => [
        row.company ?? "Unassigned",
        row.date ?? "",
        row.unitNumber,
        row.recordType,
        row.description,
        row.result ?? row.status ?? "",
        row.cost === null ? "" : money(row.cost),
      ]),
      emptyMessage: "No maintenance records match the selected filters.",
    }, report, scope);
  } catch {
    return NextResponse.json({ error: "Could not export report." }, { status: 500 });
  }
}

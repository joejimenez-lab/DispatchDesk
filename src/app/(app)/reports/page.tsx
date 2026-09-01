import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetScopeTabs } from "@/components/fleet-scope-tabs";
import { Field, Input, Select } from "@/components/field";
import { ExportMenu, type ExportMenuItem } from "@/components/export-menu";
import { SummaryTotals, WeeklySummaryList } from "@/components/weekly-report";
import { getLoadFleetCompanies } from "@/lib/data/fleet";
import { getFormOptions } from "@/lib/data/options";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";
import { fleetScopeLabel, fleetScopeParam, parseFleetScope, UNASSIGNED_FLEET } from "@/lib/fleet-scope";
import type { FinancialCompletenessFilter } from "@/lib/financials";

const PERIODS: { value: WeeklyFinancialPeriod; label: string }[] = [
  { value: "this", label: "This week" },
  { value: "last", label: "Last week" },
  { value: "all", label: "All weeks" },
  { value: "custom", label: "Custom range" },
];

function normalizePeriod(value: string | undefined): WeeklyFinancialPeriod {
  return PERIODS.some((period) => period.value === value) ? (value as WeeklyFinancialPeriod) : "all";
}

function normalizeFinancial(value: string | undefined): FinancialCompletenessFilter {
  return value === "complete" || value === "incomplete" ? value : "all";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; driver?: string; fleet?: string; financial?: string }>;
}) {
  const params = await searchParams;
  const period = normalizePeriod(params.period);
  const financial = normalizeFinancial(params.financial);
  const [options, fleetCompanies] = await Promise.all([getFormOptions(), getLoadFleetCompanies()]);
  const scope = parseFleetScope(params.fleet, fleetCompanies);
  if (!scope) notFound();
  const fleet = fleetScopeParam(scope);
  const exportParams = new URLSearchParams();
  exportParams.set("period", period);
  if (fleet) exportParams.set("fleet", fleet);
  if (params.from) exportParams.set("from", params.from);
  if (params.to) exportParams.set("to", params.to);
  if (params.driver) exportParams.set("driver", params.driver);
  exportParams.set("financial", financial);
  const exportHref = `/api/reports/weekly/export?${exportParams.toString()}`;
  const pdfExportHref = `/api/reports/weekly/pdf?${exportParams.toString()}`;
  const filteredExportHref = (report: "weekly-payroll" | "weekly-financial") =>
    `/api/reports/exports/${report}?${exportParams.toString()}`;
  const reportExportHref = (report: "weekly-payroll" | "client-billing" | "maintenance" | "yearly-financial", format: "csv" | "pdf") => {
    const params = new URLSearchParams(exportParams);
    params.set("format", format);
    return `/api/reports/exports/${report}?${params.toString()}`;
  };
  const { summaries } = await getWeeklyDriverFinancialSummary({
    period,
    from: params.from,
    to: params.to,
    driver: params.driver || undefined,
    fleetScope: scope,
    financial,
  });
  const exports: ExportMenuItem[] = [
    {
      title: "Loads",
      description: "Complete operational and payment detail for every load.",
      formats: [{ label: "Detailed CSV", description: "Every matching load with operational, pay, and billing fields.", href: `/api/loads/export?${exportParams.toString()}`, type: "csv" }],
    },
    {
      title: "Weekly driver payroll",
      description: "Payroll totals by driver and week.",
      formats: [
        { label: "Payroll CSV", description: "Driver and week totals ready for payroll processing.", href: reportExportHref("weekly-payroll", "csv"), type: "csv" },
        { label: "Payroll PDF", description: "Print-ready driver payroll totals with report context.", href: reportExportHref("weekly-payroll", "pdf"), type: "pdf" },
      ],
    },
    {
      title: "Weekly financial report",
      description: "Filtered revenue, costs, estimated profit, and load detail.",
      formats: [
        { label: "Summary CSV", description: "Weekly revenue, costs, and estimated profit totals.", href: filteredExportHref("weekly-financial"), type: "csv" },
        { label: "Detailed CSV", description: "Weekly totals plus every matching load and cost component.", href: exportHref, type: "csv" },
        { label: "Summary PDF", description: "Presentation-ready financial and driver performance summary.", href: pdfExportHref, type: "pdf" },
      ],
    },
    {
      title: "Client billing",
      description: "Invoice status, collections, and outstanding balances.",
      formats: [
        { label: "Billing CSV", description: "Invoice, collection, and outstanding balance fields by load.", href: reportExportHref("client-billing", "csv"), type: "csv" },
        { label: "Billing PDF", description: "Client-facing billing overview with invoiced and outstanding totals.", href: reportExportHref("client-billing", "pdf"), type: "pdf" },
      ],
    },
    {
      title: "Bookkeeping expenses",
      description: "Tax and receipt records with truck, trailer, load, driver, and maintenance links.",
      formats: [
        { label: "Detailed CSV", description: "Accounting rows with categories, links, and receipt references.", href: `/api/bookkeeping/export?${exportParams.toString()}&view=detailed&format=csv`, type: "csv" },
        { label: "Summary PDF", description: "Category totals and receipt counts for quick review.", href: `/api/bookkeeping/export?${exportParams.toString()}&view=summary&format=pdf`, type: "pdf" },
      ],
    },
    {
      title: "Maintenance",
      description: "Fleet service, inspection, repair, and reminder history.",
      formats: [
        { label: "History CSV", description: "Service, inspection, repair, reminder, and cost rows.", href: reportExportHref("maintenance", "csv"), type: "csv" },
        { label: "History PDF", description: "Print-ready maintenance history and recorded cost totals.", href: reportExportHref("maintenance", "pdf"), type: "pdf" },
      ],
    },
    {
      title: "Yearly financial summary",
      description: "Annual revenue, costs, load count, and estimated profit.",
      formats: [
        { label: "Annual CSV", description: "Year-by-year revenue, costs, loads, and estimated profit.", href: reportExportHref("yearly-financial", "csv"), type: "csv" },
        { label: "Annual PDF", description: "Print-ready annual performance summary with totals.", href: reportExportHref("yearly-financial", "pdf"), type: "pdf" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Reports</h1>
          <p className="text-sm text-zinc-600">{fleetScopeLabel(scope)} · Financial review and business exports.</p>
        </div>
        <ExportMenu
          items={exports}
          filters={[
            {
              key: "fleet",
              label: "Fleet",
              allLabel: "All fleets",
              defaultValue: fleet,
              options: [...fleetCompanies.map((company) => ({ label: company, value: company })), { label: "Unassigned", value: UNASSIGNED_FLEET }],
            },
            {
              key: "driver",
              label: "Driver",
              allLabel: "All drivers",
              defaultValue: params.driver ?? "",
              options: options.drivers.map((driver) => ({ label: driver.name, value: driver.id })),
            },
          ]}
        />
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-6">
        {fleet ? <input type="hidden" name="fleet" value={fleet} /> : null}
        <Field label="Period">
          <Select name="period" defaultValue={period}>
            {PERIODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" name="from" defaultValue={params.from ?? ""} />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={params.to ?? ""} />
        </Field>
        <Field label="Driver">
          <Select name="driver" defaultValue={params.driver ?? ""}>
            <option value="">All drivers</option>
            {options.drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Financial data">
          <Select name="financial" defaultValue={financial}>
            <option value="all">All records</option>
            <option value="complete">Complete only</option>
            <option value="incomplete">Incomplete only</option>
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Filter</button>
          <Link href="/reports" className="flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
        </div>
      </form>
      {period === "custom" ? (
        <p className="-mt-3 text-xs text-zinc-500">Custom range uses the From and To dates above. Leave a side blank to leave it open-ended.</p>
      ) : null}

      <FleetScopeTabs
        basePath="/reports"
        companies={fleetCompanies}
        scope={scope}
        params={{ period, from: params.from, to: params.to, driver: params.driver }}
      />

      <SummaryTotals summaries={summaries} />

      <WeeklySummaryList
        summaries={summaries}
        linkDrivers
        emptyTitle="No reportable loads"
        emptyMessage="No non-cancelled loads match the selected filters."
      />
    </div>
  );
}

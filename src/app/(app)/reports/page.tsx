import Link from "next/link";
import { FleetScopeTabs, normalizeFleetScope } from "@/components/fleet-scope-tabs";
import { Field, Input, Select } from "@/components/field";
import { ExportMenu, type ExportMenuItem } from "@/components/export-menu";
import { SummaryTotals, WeeklySummaryList } from "@/components/weekly-report";
import { getFleetCompanies } from "@/lib/data/fleet";
import { getFormOptions } from "@/lib/data/options";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";

const PERIODS: { value: WeeklyFinancialPeriod; label: string }[] = [
  { value: "this", label: "This week" },
  { value: "last", label: "Last week" },
  { value: "all", label: "All weeks" },
  { value: "custom", label: "Custom range" },
];

function normalizePeriod(value: string | undefined): WeeklyFinancialPeriod {
  return PERIODS.some((period) => period.value === value) ? (value as WeeklyFinancialPeriod) : "all";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; driver?: string; fleet?: string }>;
}) {
  const params = await searchParams;
  const period = normalizePeriod(params.period);
  const [options, fleetCompanies] = await Promise.all([getFormOptions(), getFleetCompanies()]);
  const fleet = normalizeFleetScope(params.fleet, fleetCompanies);
  const exportParams = new URLSearchParams();
  exportParams.set("period", period);
  if (fleet) exportParams.set("fleet", fleet);
  if (params.from) exportParams.set("from", params.from);
  if (params.to) exportParams.set("to", params.to);
  if (params.driver) exportParams.set("driver", params.driver);
  const exportHref = `/api/reports/weekly/export?${exportParams.toString()}`;
  const pdfExportHref = `/api/reports/weekly/pdf?${exportParams.toString()}`;
  const filteredExportHref = (report: "weekly-payroll" | "weekly-financial") =>
    `/api/reports/exports/${report}?${exportParams.toString()}`;
  const { summaries } = await getWeeklyDriverFinancialSummary({
    period,
    from: params.from,
    to: params.to,
    driver: params.driver || undefined,
    fleet: fleet || undefined,
  });
  const exports: ExportMenuItem[] = [
    {
      title: "Loads",
      description: "Complete operational and payment detail for every load.",
      formats: [{ label: "CSV", href: `/api/loads/export?${exportParams.toString()}`, type: "csv" }],
    },
    {
      title: "Weekly driver payroll",
      description: "Payroll totals by driver and week.",
      formats: [{ label: "CSV", href: filteredExportHref("weekly-payroll"), type: "csv" }],
    },
    {
      title: "Weekly financial report",
      description: "Filtered revenue, costs, estimated profit, and load detail.",
      formats: [
        { label: "Summary CSV", href: filteredExportHref("weekly-financial"), type: "csv" },
        { label: "Detailed CSV", href: exportHref, type: "csv" },
        { label: "PDF", href: pdfExportHref, type: "pdf" },
      ],
    },
    {
      title: "Client billing",
      description: "Invoice status, collections, and outstanding balances.",
      formats: [{ label: "CSV", href: `/api/reports/exports/client-billing?${exportParams.toString()}`, type: "csv" }],
    },
    {
      title: "Bookkeeping expenses",
      description: "Tax and receipt records with truck, trailer, load, driver, and maintenance links.",
      formats: [{ label: "CSV", href: "/api/bookkeeping/export", type: "csv" }],
    },
    {
      title: "Maintenance",
      description: "Fleet service, inspection, repair, and reminder history.",
      formats: [{ label: "CSV", href: `/api/reports/exports/maintenance?${exportParams.toString()}`, type: "csv" }],
    },
    {
      title: "Yearly financial summary",
      description: "Annual revenue, costs, load count, and estimated profit.",
      formats: [{ label: "CSV", href: `/api/reports/exports/yearly-financial?${exportParams.toString()}`, type: "csv" }],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Reports</h1>
          <p className="text-sm text-zinc-600">Financial review and business exports.</p>
        </div>
        <ExportMenu items={exports} />
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-5">
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
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">Filter</button>
          <Link href="/reports" className="flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
        </div>
      </form>
      {period === "custom" ? (
        <p className="-mt-3 text-xs text-zinc-500">Custom range uses the From and To dates above. Leave a side blank to leave it open-ended.</p>
      ) : null}

      <FleetScopeTabs
        basePath="/reports"
        companies={fleetCompanies}
        selectedFleet={fleet}
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

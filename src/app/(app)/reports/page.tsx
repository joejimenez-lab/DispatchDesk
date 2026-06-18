import Link from "next/link";
import { Field, Input, Select } from "@/components/field";
import { SummaryTotals, WeeklySummaryList } from "@/components/weekly-report";
import { getFormOptions } from "@/lib/data/options";
import { getWeeklyDriverFinancialSummary, type WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";
import { LinkButton } from "@/components/button";

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
  searchParams: Promise<{ period?: string; from?: string; to?: string; driver?: string }>;
}) {
  const params = await searchParams;
  const period = normalizePeriod(params.period);
  const exportParams = new URLSearchParams();
  exportParams.set("period", period);
  if (params.from) exportParams.set("from", params.from);
  if (params.to) exportParams.set("to", params.to);
  if (params.driver) exportParams.set("driver", params.driver);
  const exportHref = `/api/reports/weekly/export?${exportParams.toString()}`;
  const [{ summaries }, options] = await Promise.all([
    getWeeklyDriverFinancialSummary({
      period,
      from: params.from,
      to: params.to,
      driver: params.driver || undefined,
    }),
    getFormOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Reports</h1>
          <p className="text-sm text-zinc-600">Weekly driver payroll and financial review.</p>
        </div>
        <LinkButton href={exportHref} variant="secondary">Export CSV</LinkButton>
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-5">
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

      <SummaryTotals summaries={summaries} />

      <WeeklySummaryList
        summaries={summaries}
        linkDrivers
        emptyTitle="No reportable loads"
        emptyMessage="No non-cancelled loads match the selected period and driver."
      />
    </div>
  );
}

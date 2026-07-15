import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/button";
import { Field, Input, Select } from "@/components/field";
import { SummaryTotals, WeeklySummaryList } from "@/components/weekly-report";
import { isMissingPostgrestRow } from "@/lib/data/not-found";
import { createClient } from "@/lib/supabase/server";
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

export default async function DriverReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const period = normalizePeriod(query.period);
  const supabase = await createClient();

  const [{ data: driver, error }, { summaries }] = await Promise.all([
    supabase.from("drivers").select("name").eq("id", id).single(),
    getWeeklyDriverFinancialSummary({
      period,
      from: query.from,
      to: query.to,
      driver: id,
    }),
  ]);

  if (isMissingPostgrestRow(error) || (!error && !driver)) notFound();
  if (error) throw error;

  const exportParams = new URLSearchParams({ period, driver: id });
  if (query.from) exportParams.set("from", query.from);
  if (query.to) exportParams.set("to", query.to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/reports" className="text-sm text-zinc-500 underline-offset-2 hover:underline">
            ← Back to reports
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">{driver.name ?? "Driver"}</h1>
          <p className="text-sm text-zinc-600">Weekly payroll and financials across all weeks.</p>
        </div>
        <LinkButton href={`/api/reports/weekly/export?${exportParams.toString()}`} variant="secondary">Export CSV</LinkButton>
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-4">
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
          <Input type="date" name="from" defaultValue={query.from ?? ""} />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={query.to ?? ""} />
        </Field>
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Filter</button>
          <Link href={`/reports/drivers/${id}`} className="flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
        </div>
      </form>
      {period === "custom" ? (
        <p className="-mt-3 text-xs text-zinc-500">Custom range uses the From and To dates above. Leave a side blank to leave it open-ended.</p>
      ) : null}

      <SummaryTotals summaries={summaries} />

      <WeeklySummaryList
        summaries={summaries}
        emptyTitle="No reportable loads"
        emptyMessage="This driver has no non-cancelled loads for the selected period."
      />
    </div>
  );
}

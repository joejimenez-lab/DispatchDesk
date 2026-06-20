import Link from "next/link";
import type { WeeklyDriverFinancialSummary } from "@/lib/data/weekly-financials";
import { currency, formatDate } from "@/lib/utils";

export function SummaryTotals({ summaries }: { summaries: WeeklyDriverFinancialSummary[] }) {
  const totals = summaries.reduce(
    (totals, summary) => ({
      loadCount: totals.loadCount + summary.loadCount,
      loadRateTotal: totals.loadRateTotal + summary.loadRateTotal,
      driverPayTotal: totals.driverPayTotal + summary.driverPayTotal,
      dispatcherFeeTotal: totals.dispatcherFeeTotal + summary.dispatcherFeeTotal,
      fuelCostTotal: totals.fuelCostTotal + summary.fuelCostTotal,
      estimatedProfitTotal: totals.estimatedProfitTotal + summary.estimatedProfitTotal,
    }),
    {
      loadCount: 0,
      loadRateTotal: 0,
      driverPayTotal: 0,
      dispatcherFeeTotal: 0,
      fuelCostTotal: 0,
      estimatedProfitTotal: 0,
    },
  );

  const cards: [string, string | number][] = [
    ["Loads", totals.loadCount],
    ["Load Rate", currency(totals.loadRateTotal)],
    ["Driver Pay", currency(totals.driverPayTotal)],
    ["Dispatcher Fee", currency(totals.dispatcherFeeTotal)],
    ["Fuel Cost", currency(totals.fuelCostTotal)],
    ["Estimated Profit", currency(totals.estimatedProfitTotal)],
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
          <div className="mt-2 text-xl font-semibold text-zinc-950">{value}</div>
        </div>
      ))}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function WeekCard({ summary, linkDriver }: { summary: WeeklyDriverFinancialSummary; linkDriver: boolean }) {
  const driverHeading =
    linkDriver && summary.driverId ? (
      <Link href={`/reports/drivers/${summary.driverId}`} className="underline-offset-2 hover:underline">
        {summary.driverName}
      </Link>
    ) : (
      summary.driverName
    );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">{driverHeading}</h2>
          <p className="text-sm text-zinc-500">
            {formatDate(summary.weekStart)} to {formatDate(summary.weekEnd)} · {summary.loadCount} load
            {summary.loadCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
          <Metric label="Load rate" value={currency(summary.loadRateTotal)} />
          <Metric label="Driver pay" value={currency(summary.driverPayTotal)} />
          <Metric label="Dispatcher fee" value={currency(summary.dispatcherFeeTotal)} />
          <Metric label="Fuel" value={currency(summary.fuelCostTotal)} />
          <Metric label="Profit" value={currency(summary.estimatedProfitTotal)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Load</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Driver Pay</th>
              <th className="px-4 py-3 text-right">Dispatcher Fee</th>
              <th className="px-4 py-3 text-right">Fuel</th>
              <th className="px-4 py-3 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {summary.loads.map((load) => (
              <tr key={load.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-semibold text-zinc-950">
                  <Link href={`/loads/${load.id}`} className="underline-offset-2 hover:underline">
                    {load.loadNumber}
                  </Link>
                  {load.isRoundTrip ? (
                    <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Round trip
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-700">{formatDate(load.date)}</td>
                <td className="px-4 py-3 text-zinc-700">{load.status}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{currency(load.loadRate)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{currency(load.driverPay)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{currency(load.dispatcherFee)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{currency(load.fuelCost)}</td>
                <td className="px-4 py-3 text-right font-semibold text-zinc-950">{currency(load.estimatedProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WeeklySummaryList({
  summaries,
  linkDrivers = false,
  emptyTitle,
  emptyMessage,
}: {
  summaries: WeeklyDriverFinancialSummary[];
  linkDrivers?: boolean;
  emptyTitle: string;
  emptyMessage: string;
}) {
  return (
    <section className="space-y-4">
      {summaries.map((summary) => (
        <WeekCard key={summary.key} summary={summary} linkDriver={linkDrivers} />
      ))}
      {!summaries.length ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
          <div className="text-sm font-medium text-zinc-900">{emptyTitle}</div>
          <p className="mt-1 text-sm text-zinc-500">{emptyMessage}</p>
        </div>
      ) : null}
    </section>
  );
}

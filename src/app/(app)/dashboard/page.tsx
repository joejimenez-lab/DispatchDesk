import { LinkButton } from "@/components/button";
import { currency } from "@/lib/utils";
import { getDashboardMetrics } from "@/lib/data/dashboard";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const cards = [
    ["Active Loads", metrics.activeLoads],
    ["Delivered Loads", metrics.deliveredLoads],
    ["Unpaid Loads", metrics.unpaidLoads],
    ["Closed Loads", metrics.closedLoads],
    ["Total Revenue", currency(metrics.totalRevenue)],
    ["Outstanding Revenue", currency(metrics.outstandingRevenue)],
    ["Pending Driver Payments", currency(metrics.pendingDriverPayments)],
    ["Pending Dispatcher Fees", currency(metrics.pendingDispatcherFees)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Dashboard</h1>
          <p className="text-sm text-zinc-600">Operational and payment summary.</p>
        </div>
        <LinkButton href="/loads/new">Create load</LinkButton>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="text-sm font-medium text-zinc-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-950">{value}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

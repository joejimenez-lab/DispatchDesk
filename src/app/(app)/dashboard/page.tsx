import Link from "next/link";
import { LinkButton } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { currency, formatDate } from "@/lib/utils";
import { getDashboardMetrics } from "@/lib/data/dashboard";

function daysAgo(value: string | null) {
  if (!value) return "No date";
  const then = new Date(`${value}T00:00:00`).getTime();
  const now = new Date(new Date().toDateString()).getTime();
  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  return `${days} day${days === 1 ? "" : "s"}`;
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-zinc-950" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const maxStatusCount = Math.max(0, ...metrics.statusCounts.map(([, count]) => count));
  const totalRevenue = Math.max(metrics.totalRevenue, 1);
  const collectedWidth = Math.round((metrics.collectedRevenue / totalRevenue) * 100);
  const outstandingWidth = Math.round((metrics.outstandingRevenue / totalRevenue) * 100);
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

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Current Loads</h2>
              <p className="text-sm text-zinc-500">Open work ordered by delivery date.</p>
            </div>
            <Link href="/loads" className="text-sm font-medium text-zinc-950 underline">View all</Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {metrics.currentLoads.map((load) => (
              <Link key={load.id} href={`/loads/${load.id}`} className="grid gap-3 py-3 hover:bg-zinc-50 sm:grid-cols-[120px_1fr_130px_130px]">
                <div className="font-semibold text-zinc-950">
                  {load.load_number}
                  {load.is_round_trip ? (
                    <span className="mt-1 block text-xs font-semibold text-amber-800">Round trip</span>
                  ) : null}
                </div>
                <div>
                  <div className="text-sm text-zinc-900">{load.pickup_location} to {load.delivery_location}</div>
                  <div className="text-xs text-zinc-500">
                    {load.brokers?.company_name ?? "No broker"} · {load.drivers?.name ?? "No driver"}
                  </div>
                </div>
                <div className="text-sm text-zinc-700">{formatDate(load.delivery_date)}</div>
                <StatusBadge status={load.status} />
              </Link>
            ))}
            {!metrics.currentLoads.length ? <p className="py-6 text-sm text-zinc-500">No active loads right now.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Payment Alerts</h2>
          <p className="mb-4 text-sm text-zinc-500">Client payments overdue 30+ days.</p>
          <div className="space-y-3">
            {metrics.unpaidAlerts.map((load) => (
              <Link key={load.id} href={`/loads/${load.id}`} className="block rounded-md border border-red-100 bg-red-50 p-3 hover:bg-red-100">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-red-950">{load.load_number}</span>
                  <span className="text-xs font-semibold text-red-700">{daysAgo(load.delivery_date ?? load.pickup_date)} old</span>
                </div>
                <div className="mt-1 text-sm text-red-900">{currency(load.outstandingAmount)} outstanding</div>
                <div className="text-xs text-red-700">Delivery: {formatDate(load.delivery_date)}</div>
              </Link>
            ))}
            {!metrics.unpaidAlerts.length ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">No 30+ day unpaid client loads.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Revenue Split</h2>
          <p className="mb-4 text-sm text-zinc-500">Collected versus still outstanding.</p>
          <div className="flex h-4 overflow-hidden rounded-full bg-zinc-100">
            <div className="bg-green-600" style={{ width: `${collectedWidth}%` }} />
            <div className="bg-amber-500" style={{ width: `${outstandingWidth}%` }} />
          </div>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Collected</span>
              <span className="font-semibold text-zinc-950">{currency(metrics.collectedRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Outstanding</span>
              <span className="font-semibold text-zinc-950">{currency(metrics.outstandingRevenue)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Load Statuses</h2>
          <p className="mb-4 text-sm text-zinc-500">Where loads are sitting.</p>
          <div className="space-y-3">
            {metrics.statusCounts.map(([status, count]) => (
              <ProgressBar key={status} label={status} value={count} max={maxStatusCount} />
            ))}
            {!metrics.statusCounts.length ? <p className="text-sm text-zinc-500">No loads yet.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">Upcoming Deliveries</h2>
          <p className="mb-4 text-sm text-zinc-500">Next delivery dates to watch.</p>
          <div className="divide-y divide-zinc-100">
            {metrics.upcomingDeliveries.map((load) => (
              <Link key={load.id} href={`/loads/${load.id}`} className="block py-3 hover:bg-zinc-50">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-zinc-950">{load.load_number}</span>
                  <span className="text-sm text-zinc-600">{formatDate(load.delivery_date)}</span>
                </div>
                <div className="mt-1 text-sm text-zinc-600">{load.delivery_location}</div>
              </Link>
            ))}
            {!metrics.upcomingDeliveries.length ? <p className="py-4 text-sm text-zinc-500">No upcoming deliveries.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

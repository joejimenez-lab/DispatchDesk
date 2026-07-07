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
          <p className="text-sm text-zinc-600">Operational, payment, and maintenance summary.</p>
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
            {metrics.currentLoads.map((load) => {
              const returnLocation = load.return_location || load.pickup_location;

              return (
                <Link
                  key={load.id}
                  href={`/loads/${load.id}`}
                  className="grid gap-x-8 gap-y-2 py-4 hover:bg-zinc-50 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <div className="font-semibold text-zinc-950">
                    {load.load_number}
                    {load.is_round_trip ? (
                      <span className="mt-1 block text-xs font-semibold text-amber-800">Round trip · returns to {returnLocation}</span>
                    ) : null}
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="text-xs font-semibold uppercase text-zinc-500">Pickup</div>
                    <div className="break-words font-medium text-zinc-900">{load.pickup_location}</div>
                    <div className="text-xs text-zinc-500">{formatDate(load.pickup_date)}</div>
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="text-xs font-semibold uppercase text-zinc-500">Delivery</div>
                    <div className="break-words font-medium text-zinc-900">{load.delivery_location}</div>
                    <div className="text-xs text-zinc-500">{formatDate(load.delivery_date)}</div>
                    {load.is_round_trip ? (
                      <div className="mt-1 text-xs font-medium text-amber-800">Return: {returnLocation}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500 md:col-span-2 md:col-start-2">
                    {load.brokers?.company_name ?? "No broker"} · {load.drivers?.name ?? "No driver"}
                  </div>
                  <div className="justify-self-start md:col-start-4 md:row-start-1">
                    <StatusBadge status={load.status} />
                  </div>
                </Link>
              );
            })}
            {!metrics.currentLoads.length ? <p className="py-6 text-sm text-zinc-500">No active loads right now.</p> : null}
          </div>
        </div>

        <div className="space-y-4">
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

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">Maintenance Alerts</h2>
                <p className="text-sm text-zinc-500">Date and mileage schedules needing attention.</p>
              </div>
              <Link href="/maintenance" className="text-sm font-medium text-zinc-950 underline">View all</Link>
            </div>
            <div className="my-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-red-50 p-2 text-red-800"><div className="text-lg font-semibold">{metrics.maintenanceCounts.overdue}</div>Overdue</div>
              <div className="rounded-md bg-amber-50 p-2 text-amber-800"><div className="text-lg font-semibold">{metrics.maintenanceCounts["due-soon"]}</div>Due soon</div>
              <div className="rounded-md bg-blue-50 p-2 text-blue-800"><div className="text-lg font-semibold">{metrics.maintenanceCounts.upcoming}</div>Upcoming</div>
            </div>
            <div className="space-y-3">
              {metrics.maintenanceAlerts.map((reminder) => {
                const overdue = reminder.status === "overdue";
                const remaining = reminder.daysRemaining != null
                  ? reminder.daysRemaining < 0 ? `${Math.abs(reminder.daysRemaining)}d overdue` : reminder.daysRemaining === 0 ? "Due today" : `${reminder.daysRemaining}d left`
                  : reminder.milesRemaining != null
                    ? reminder.milesRemaining < 0 ? `${Math.abs(reminder.milesRemaining).toLocaleString()} mi overdue` : `${reminder.milesRemaining.toLocaleString()} mi left`
                    : "Due soon";
                return (
                  <Link
                    key={reminder.id}
                    href={`/maintenance#reminder-${reminder.id}`}
                    className={overdue
                      ? "block rounded-md border border-red-100 bg-red-50 p-3 hover:bg-red-100"
                      : "block rounded-md border border-amber-100 bg-amber-50 p-3 hover:bg-amber-100"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={overdue ? "font-semibold text-red-950" : "font-semibold text-amber-950"}>
                        {reminder.unit.unit_number}
                      </span>
                      <span className={overdue ? "text-right text-xs font-semibold text-red-700" : "text-right text-xs font-semibold text-amber-700"}>
                        {remaining}
                      </span>
                    </div>
                    <div className={overdue ? "mt-1 text-sm text-red-900" : "mt-1 text-sm text-amber-900"}>{reminder.reminder_type}</div>
                    <div className={overdue ? "text-xs text-red-700" : "text-xs text-amber-700"}>
                      {reminder.due_date ? `Due ${formatDate(reminder.due_date)}` : ""}
                      {reminder.due_date && reminder.due_odometer != null ? " · " : ""}
                      {reminder.due_odometer != null ? `${reminder.due_odometer.toLocaleString()} mi` : ""}
                    </div>
                  </Link>
                );
              })}
              {!metrics.maintenanceAlerts.length ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">No unsnoozed maintenance needs attention.</p> : null}
            </div>
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
                <div className="font-semibold text-zinc-950">{load.load_number}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="min-w-0 rounded-md bg-zinc-50 p-2">
                    <div className="text-xs font-semibold uppercase text-zinc-500">Pickup</div>
                    <div className="break-words text-sm font-medium text-zinc-900">{load.pickup_location}</div>
                    <div className="text-xs text-zinc-500">{formatDate(load.pickup_date)}</div>
                  </div>
                  <div className="min-w-0 rounded-md bg-zinc-50 p-2">
                    <div className="text-xs font-semibold uppercase text-zinc-500">Delivery</div>
                    <div className="break-words text-sm font-medium text-zinc-900">{load.delivery_location}</div>
                    <div className="text-xs text-zinc-500">{formatDate(load.delivery_date)}</div>
                  </div>
                </div>
              </Link>
            ))}
            {!metrics.upcomingDeliveries.length ? <p className="py-4 text-sm text-zinc-500">No upcoming deliveries.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

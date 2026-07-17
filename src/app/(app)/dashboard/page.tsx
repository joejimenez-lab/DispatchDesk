import Link from "next/link";
import type { CSSProperties } from "react";
import {
  CircleCheckBig,
  CircleDollarSign,
  Clock3,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { LinkButton } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { currency, formatDate } from "@/lib/utils";
import { getDashboardMetrics } from "@/lib/data/dashboard";

function overdueAge(value: string | null) {
  if (!value) return "Delivery date unavailable";
  const then = new Date(`${value}T00:00:00`).getTime();
  const now = new Date(new Date().toDateString()).getTime();
  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-zinc-500">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[#e2e0ee]">
        <div className="h-full rounded-full bg-[#6757e8]" style={{ width: width + "%" }} />
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
  const cards: Array<{ label: string; value: string | number; icon: LucideIcon; color: string }> = [
    { label: "Active loads", value: metrics.activeLoads, icon: Truck, color: "#6757e8" },
    { label: "Delivered loads", value: metrics.deliveredLoads, icon: CircleCheckBig, color: "#39805d" },
    { label: "Unpaid loads", value: metrics.unpaidLoads, icon: Clock3, color: "#bc5262" },
    { label: "Total revenue", value: currency(metrics.totalRevenue), icon: CircleDollarSign, color: "#303047" },
  ];

  return (
    <div className="space-y-5">
      <section className="dashboard-hero">
        <div className="dashboard-hero-heading">
          <div>
            <h1>Dashboard</h1>
            <p>Overview of loads, payments, revenue, and maintenance.</p>
          </div>
          <LinkButton href="/loads/new">
            <span aria-hidden="true">+</span> Create load
          </LinkButton>
        </div>
        <div className="dashboard-metrics" aria-label="Operating summary">
          {cards.map(({ label, value, icon: Icon, color }, index) => (
            <div
              key={label}
              className={`dashboard-metric dashboard-metric-${index + 1}`}
              style={{ "--metric-color": color } as CSSProperties}
            >
              <div className="dashboard-metric-header">
                <div className="dashboard-metric-label">{label}</div>
                <Icon className="dashboard-metric-icon" aria-hidden="true" />
              </div>
              <div className="dashboard-metric-value">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="dispatch-panel lg:col-span-2">
          <div className="panel-heading">
            <div>
              <h2>Current loads</h2>
              <p>Active loads ordered by delivery date.</p>
            </div>
            <Link href="/loads" className="panel-link">View all loads</Link>
          </div>
          <div className="divide-y divide-zinc-200 px-5">
            {metrics.currentLoads.map((load) => {
              const returnLocation = load.return_location || load.pickup_location;

              return (
                <Link
                  key={load.id}
                  href={`/loads/${load.id}`}
                  className="load-ledger-row grid gap-x-8 gap-y-2 py-4 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]"
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
          <div className="dispatch-panel">
            <div className="panel-heading"><div><h2>Overdue payments</h2><p>Client payments overdue by 30 days or more.</p></div></div>
            <div className="dispatch-panel-inner space-y-3">
              {metrics.unpaidAlerts.map((load) => (
                <Link key={load.id} href={`/loads/${load.id}`} className="block rounded-md border border-red-100 bg-red-50 p-3 hover:bg-red-100">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-red-950">{load.load_number}</span>
                    <span className="text-xs font-semibold text-red-700">{overdueAge(load.delivery_date ?? load.pickup_date)}</span>
                  </div>
                  <div className="mt-1 text-sm text-red-900">{currency(load.outstandingAmount)} outstanding</div>
                  <div className="text-xs text-red-700">Delivery: {formatDate(load.delivery_date)}</div>
                </Link>
              ))}
              {!metrics.unpaidAlerts.length ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">No client payments are more than 30 days overdue.</p> : null}
            </div>
          </div>

          <div className="dispatch-panel">
            <div className="panel-heading">
              <div>
                <h2>Maintenance alerts</h2>
                <p>Scheduled service that needs attention.</p>
              </div>
              <Link href="/maintenance" className="panel-link">View maintenance</Link>
            </div>
            <div className="dispatch-panel-inner">
              <div className="maintenance-tally">
                <div data-tone="danger"><strong>{metrics.maintenanceCounts.overdue}</strong><span>Overdue</span></div>
                <div data-tone="warning"><strong>{metrics.maintenanceCounts["due-soon"]}</strong><span>Due soon</span></div>
                <div data-tone="info"><strong>{metrics.maintenanceCounts.upcoming}</strong><span>Upcoming</span></div>
              </div>
              <div className="mt-4 space-y-3">
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
              {!metrics.maintenanceAlerts.length ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">No maintenance alerts right now.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="dispatch-panel">
          <div className="panel-heading"><div><h2>Revenue</h2><p>Collected and outstanding revenue.</p></div></div>
          <div className="dispatch-panel-inner">
          <div className="flex h-2 overflow-hidden bg-zinc-200">
            <div className="bg-emerald-700" style={{ width: `${collectedWidth}%` }} />
            <div className="bg-amber-600" style={{ width: `${outstandingWidth}%` }} />
          </div>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Total revenue</span>
              <span className="font-semibold text-zinc-950">{currency(metrics.totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Collected</span>
              <span className="font-semibold text-zinc-950">{currency(metrics.collectedRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Outstanding</span>
              <span className="font-semibold text-zinc-950">{currency(metrics.outstandingRevenue)}</span>
            </div>
            <div className="mt-1 border-t border-zinc-200 pt-3 flex items-center justify-between">
              <span className="text-zinc-600">Pending driver payments</span>
              <span className="font-semibold text-zinc-950">{currency(metrics.pendingDriverPayments)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Pending dispatcher fees</span>
              <span className="font-semibold text-zinc-950">{currency(metrics.pendingDispatcherFees)}</span>
            </div>
          </div></div>
        </div>

        <div className="dispatch-panel">
          <div className="panel-heading"><div><h2>Loads by status</h2><p>Number of loads in each status.</p></div></div>
          <div className="dispatch-panel-inner space-y-3">
            {metrics.statusCounts.map(([status, count]) => (
              <ProgressBar key={status} label={status} value={count} max={maxStatusCount} />
            ))}
            {!metrics.statusCounts.length ? <p className="text-sm text-zinc-500">No loads yet.</p> : null}
          </div>
        </div>

        <div className="dispatch-panel">
          <div className="panel-heading"><div><h2>Upcoming deliveries</h2><p>Loads with the nearest delivery dates.</p></div></div>
          <div className="divide-y divide-zinc-200 px-5">
            {metrics.upcomingDeliveries.map((load) => (
              <Link key={load.id} href={`/loads/${load.id}`} className="block py-3 hover:bg-zinc-50">
                <div className="font-semibold text-zinc-950">{load.load_number}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="min-w-0 border-l-2 border-zinc-300 bg-zinc-50 p-2">
                    <div className="text-xs font-semibold uppercase text-zinc-500">Pickup</div>
                    <div className="break-words text-sm font-medium text-zinc-900">{load.pickup_location}</div>
                    <div className="text-xs text-zinc-500">{formatDate(load.pickup_date)}</div>
                  </div>
                  <div className="min-w-0 border-l-2 border-[#6757e8] bg-zinc-50 p-2">
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

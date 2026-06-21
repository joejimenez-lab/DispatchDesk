import Link from "next/link";
import { DetailsCloseButton } from "@/components/details-close-button";
import { MaintenanceReminderCard } from "@/components/maintenance-reminder-card";
import { MaintenanceReminderForm } from "@/components/maintenance-reminder-form";
import { addMaintenanceReminder } from "@/lib/actions/maintenance";
import { getMaintenanceAlerts } from "@/lib/data/maintenance";
import { getUnits } from "@/lib/data/fleet";
import type { MaintenanceStatus } from "@/lib/maintenance";

const filters: { label: string; value: "all" | MaintenanceStatus }[] = [
  { label: "All", value: "all" },
  { label: "Overdue", value: "overdue" },
  { label: "Due soon", value: "due-soon" },
  { label: "Upcoming", value: "upcoming" },
];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; unit?: string }>;
}) {
  const params = await searchParams;
  const [alerts, units] = await Promise.all([getMaintenanceAlerts(), getUnits()]);
  const status = filters.some((filter) => filter.value === params.status) ? params.status : "all";
  const counts = alerts.reduce(
    (result, alert) => ({ ...result, [alert.status]: result[alert.status] + 1 }),
    { overdue: 0, "due-soon": 0, upcoming: 0 },
  );
  const visible = alerts.filter((alert) =>
    (status === "all" || alert.status === status) && (!params.unit || alert.unit_id === params.unit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Maintenance</h1>
          <p className="text-sm text-zinc-600">All active date- and mileage-based fleet schedules.</p>
        </div>
        <details className="group w-full sm:w-auto">
          <summary className="cursor-pointer list-none rounded-md bg-zinc-950 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800">+ Add schedule</summary>
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:absolute lg:left-1/2 lg:z-10 lg:w-[min(68rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:shadow-xl">
            <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
            <MaintenanceReminderForm action={addMaintenanceReminder} units={units} submitLabel="Add schedule" />
          </div>
        </details>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4"><div className="text-sm font-medium text-red-700">Overdue</div><div className="mt-1 text-2xl font-semibold text-red-950">{counts.overdue}</div></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-medium text-amber-700">Due soon</div><div className="mt-1 text-2xl font-semibold text-amber-950">{counts["due-soon"]}</div></div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="text-sm font-medium text-blue-700">Upcoming</div><div className="mt-1 text-2xl font-semibold text-blue-950">{counts.upcoming}</div></div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Maintenance status filters">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={`/maintenance?status=${filter.value}${params.unit ? `&unit=${params.unit}` : ""}`}
            className={status === filter.value
              ? "rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
              : "rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"}
          >
            {filter.label}
          </Link>
        ))}
        {params.unit ? <Link href={`/maintenance?status=${status}`} className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 underline">Clear unit filter</Link> : null}
      </nav>

      <section className="grid gap-4">
        {visible.map((alert) => <MaintenanceReminderCard key={alert.id} alert={alert} />)}
        {!visible.length ? <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">No maintenance schedules match this filter.</p> : null}
      </section>
    </div>
  );
}

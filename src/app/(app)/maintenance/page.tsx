import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailsCloseButton } from "@/components/details-close-button";
import { FleetScopeTabs } from "@/components/fleet-scope-tabs";
import { MaintenanceReminderCard } from "@/components/maintenance-reminder-card";
import { MaintenanceReminderForm } from "@/components/maintenance-reminder-form";
import { MaintenanceSetupForm } from "@/components/maintenance-setup-form";
import { addMaintenanceReminder, configureMaintenanceUnits } from "@/lib/actions/maintenance";
import { getMaintenanceAlerts } from "@/lib/data/maintenance";
import { getFleetCompanies, getUnits } from "@/lib/data/fleet";
import { buildMaintenanceReadiness, summarizeMaintenanceReadiness, type MaintenanceStatus } from "@/lib/maintenance";
import { fleetScopeLabel, fleetScopeParam, matchesFleetScope, parseFleetScope } from "@/lib/fleet-scope";

type MaintenanceFilter = "all" | MaintenanceStatus | "not-configured";

const filters: { label: string; value: MaintenanceFilter }[] = [
  { label: "All", value: "all" },
  { label: "Not configured", value: "not-configured" },
  { label: "Overdue", value: "overdue" },
  { label: "Due soon", value: "due-soon" },
  { label: "Upcoming", value: "upcoming" },
];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; unit?: string; fleet?: string }>;
}) {
  const params = await searchParams;
  const [units, fleetCompanies] = await Promise.all([getUnits(), getFleetCompanies()]);
  const scope = parseFleetScope(params.fleet, fleetCompanies);
  if (!scope) notFound();
  const fleet = fleetScopeParam(scope);
  const alerts = await getMaintenanceAlerts(scope);
  const filteredUnits = units.filter((unit) => matchesFleetScope(unit.company, scope));
  const status = filters.some((filter) => filter.value === params.status)
    ? (params.status as MaintenanceFilter)
    : "all";
  const readiness = buildMaintenanceReadiness(filteredUnits, alerts);
  const readinessSummary = summarizeMaintenanceReadiness(readiness);
  const counts = alerts.reduce(
    (result, alert) => ({ ...result, [alert.status]: result[alert.status] + 1 }),
    { overdue: 0, "due-soon": 0, upcoming: 0 },
  );
  const visible = alerts.filter((alert) =>
    status !== "not-configured" && (status === "all" || alert.status === status) && (!params.unit || alert.unit_id === params.unit));
  const visibleReadiness = readiness.filter((item) =>
    (!params.unit || item.unit.id === params.unit) && (status !== "not-configured" || !item.configured));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Maintenance</h1>
          <p className="text-sm text-zinc-600">{fleetScopeLabel(scope)} · Active date- and mileage-based schedules.</p>
        </div>
        <details className="group w-full sm:w-auto">
          <summary className="cursor-pointer list-none rounded-[10px] bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700">+ Add schedule</summary>
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:absolute lg:left-1/2 lg:z-10 lg:w-[min(68rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:shadow-xl">
            <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
            <MaintenanceReminderForm action={addMaintenanceReminder} units={filteredUnits} submitLabel="Add schedule" />
          </div>
        </details>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4"><div className="text-sm font-medium text-violet-700">Not configured</div><div className="mt-1 text-2xl font-semibold text-violet-950">{readinessSummary.unconfigured}</div><div className="mt-1 text-xs text-violet-700">{readinessSummary.missingOdometers} missing odometers · {readinessSummary.missingSchedules} missing schedules</div></div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4"><div className="text-sm font-medium text-red-700">Overdue</div><div className="mt-1 text-2xl font-semibold text-red-950">{counts.overdue}</div></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-medium text-amber-700">Due soon</div><div className="mt-1 text-2xl font-semibold text-amber-950">{counts["due-soon"]}</div></div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="text-sm font-medium text-blue-700">Upcoming</div><div className="mt-1 text-2xl font-semibold text-blue-950">{counts.upcoming}</div></div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Maintenance status filters">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={`/maintenance?${new URLSearchParams({
              status: filter.value,
              ...(fleet ? { fleet } : {}),
              ...(params.unit ? { unit: params.unit } : {}),
            }).toString()}`}
            className={status === filter.value
              ? "rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              : "rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"}
          >
            {filter.label}
          </Link>
        ))}
        {params.unit ? <Link href={`/maintenance?${new URLSearchParams({ status, ...(fleet ? { fleet } : {}) }).toString()}`} className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 underline">Clear unit filter</Link> : null}
      </nav>

      <FleetScopeTabs
        basePath="/maintenance"
        companies={fleetCompanies}
        scope={scope}
        params={{ status }}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Maintenance readiness</h2>
            <p className="text-sm text-zinc-600">Tracking is healthy only after every unit has an odometer and at least one active schedule.</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-zinc-950">{readinessSummary.configured}/{readiness.length}</div>
            <div className="text-xs text-zinc-500">units configured</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-3"><div className="text-xs text-zinc-500">Missing odometers</div><div className="mt-1 text-xl font-semibold text-zinc-950">{readinessSummary.missingOdometers}</div></div>
          <div className="rounded-lg bg-zinc-50 p-3"><div className="text-xs text-zinc-500">Missing schedules</div><div className="mt-1 text-xl font-semibold text-zinc-950">{readinessSummary.missingSchedules}</div></div>
          <div className="rounded-lg bg-zinc-50 p-3"><div className="text-xs text-zinc-500">Stale or unknown readings</div><div className="mt-1 text-xl font-semibold text-zinc-950">{readinessSummary.staleOdometers}</div></div>
        </div>
        <details className="mt-5 border-t border-zinc-100 pt-4" open={readinessSummary.unconfigured > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-blue-700">Bulk odometer and schedule setup</summary>
          <div className="mt-4"><MaintenanceSetupForm action={configureMaintenanceUnits} readiness={readiness} /></div>
        </details>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold text-zinc-950">Unit setup checklist</h2><p className="text-sm text-zinc-600">Every unit remains visible until both required setup steps are complete.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleReadiness.map((item) => (
            <Link key={item.unit.id} href={`/fleet/${item.unit.id}`} className={item.configured ? "rounded-xl border border-green-200 bg-green-50 p-4" : "rounded-xl border border-amber-200 bg-amber-50 p-4"}>
              <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-zinc-950">{item.unit.unit_number}</div><div className="text-xs text-zinc-500">{item.unit.unit_type} · {item.unit.company ?? "No fleet company"}</div></div><span className={item.configured ? "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800" : "rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"}>{item.configured ? "Configured" : "Not configured"}</span></div>
              <div className="mt-3 grid gap-1 text-sm text-zinc-700">
                <div>{item.missingOdometer ? "○ Record current odometer" : `✓ Odometer: ${item.unit.odometer?.toLocaleString()} mi`}</div>
                <div>{item.missingSchedule ? "○ Add a maintenance schedule" : "✓ Active schedule added"}</div>
                <div className="text-xs text-zinc-500">Last odometer update: {item.unit.odometer_updated_at ? new Date(item.unit.odometer_updated_at).toLocaleDateString() : item.missingOdometer ? "Never" : "Unknown (existing reading)"}{item.odometerFreshness === "stale" ? ` · ${item.odometerAgeDays} days old` : ""}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {status !== "not-configured" ? <section className="grid gap-4">
        {visible.map((alert) => <MaintenanceReminderCard key={alert.id} alert={alert} />)}
        {!visible.length ? <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">{readinessSummary.unconfigured ? "No scheduled alerts match this filter. Unconfigured units are listed above." : "Maintenance is configured and there are no schedules matching this filter."}</p> : null}
      </section> : null}
    </div>
  );
}

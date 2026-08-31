import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { FleetScopeTabs } from "@/components/fleet-scope-tabs";
import { Field, Input } from "@/components/field";
import { StatusBadge } from "@/components/status-badge";
import { getDispatchBoardLoads } from "@/lib/data/dispatch";
import { getLoadFleetCompanies } from "@/lib/data/fleet";
import { findAssignmentConflicts, formatStopWindow, isLateStop, scheduleWindow, stopDate, type AssignmentWindow, type DispatchStop } from "@/lib/dispatch";
import { fleetScopeLabel, fleetScopeParam, parseFleetScope } from "@/lib/fleet-scope";

function dateInPacific() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftedDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : dateInPacific();
}

export default async function DispatchPage({ searchParams }: { searchParams: Promise<{ date?: string; fleet?: string }> }) {
  const params = await searchParams;
  const companies = await getLoadFleetCompanies();
  const scope = parseFleetScope(params.fleet, companies);
  if (!scope) notFound();
  const date = validDate(params.date);
  const fleet = fleetScopeParam(scope);
  const loads = await getDispatchBoardLoads(scope);
  const windows: AssignmentWindow[] = loads.flatMap((load) => {
    const window = scheduleWindow(load.load_stops as DispatchStop[]);
    return window ? [{ loadId: load.id, loadNumber: load.load_number, driverId: load.driver_id, driverName: load.drivers?.name ?? null, truckUnitId: load.truck_unit_id, truckNumber: load.truck_number, trailerUnitId: load.trailer_unit_id, trailerNumber: load.trailer_number, ...window }] : [];
  });
  const entries = loads.map((load) => {
    const dayStops = (load.load_stops as DispatchStop[]).filter((stop) => stopDate(stop) === date);
    const conflicts = findAssignmentConflicts({ driverId: load.driver_id, truckUnitId: load.truck_unit_id, trailerUnitId: load.trailer_unit_id }, load.load_stops as DispatchStop[], windows, load.id);
    const missingAssignment = !load.driver_id || !load.truck_unit_id;
    const missingWindow = dayStops.some((stop) => stop.schedule_precision === "date") || !load.load_stops.some((stop) => stop.scheduled_start);
    const late = dayStops.some((stop) => isLateStop(stop));
    const followUp = late ? "Late appointment" : conflicts.length ? "Resolve assignment conflict" : missingAssignment ? "Assign driver / truck" : missingWindow ? "Confirm appointment window" : "Monitor progress";
    return { load, dayStops, conflicts, missingAssignment, missingWindow, late, followUp };
  });
  const scheduled = entries.filter((entry) => entry.dayStops.length);
  const unscheduled = entries.filter((entry) => !entry.load.load_stops.some((stop) => stop.scheduled_start));
  const grouped = new Map<string, typeof scheduled>();
  for (const entry of scheduled) {
    const label = entry.load.drivers?.name ?? "Unassigned";
    grouped.set(label, [...(grouped.get(label) ?? []), entry]);
  }
  const exceptionCount = scheduled.filter((entry) => entry.late || entry.conflicts.length || entry.missingAssignment || entry.missingWindow).length + unscheduled.length;
  const hrefFor = (targetDate: string) => `/dispatch?date=${targetDate}${fleet ? `&fleet=${encodeURIComponent(fleet)}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-zinc-950">Daily Dispatch</h1><p className="text-sm text-zinc-600">{fleetScopeLabel(scope)} · Appointments, assignments, and exceptions for {date}.</p></div>
        <Link href="/loads/new" className="rounded-xl bg-[#6757e8] px-4 py-2.5 text-sm font-semibold text-white">Create load</Link>
      </div>

      <FleetScopeTabs basePath="/dispatch" companies={companies} scope={scope} params={{ date }} />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        {fleet ? <input type="hidden" name="fleet" value={fleet} /> : null}
        <Field label="Dispatch date"><Input type="date" name="date" defaultValue={date} /></Field>
        <button className="h-10 rounded-xl bg-[#6757e8] px-4 text-sm font-semibold text-white">View day</button>
        <Link className="flex h-10 items-center rounded-xl border border-zinc-300 px-3 text-sm font-medium" href={hrefFor(shiftedDate(date, -1))}>← Previous</Link>
        <Link className="flex h-10 items-center rounded-xl border border-zinc-300 px-3 text-sm font-medium" href={hrefFor(shiftedDate(date, 1))}>Next →</Link>
      </form>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scheduled loads</div><div className="mt-1 text-2xl font-semibold">{scheduled.length}</div></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Exceptions</div><div className="mt-1 text-2xl font-semibold text-amber-950">{exceptionCount}</div></div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-violet-700">Unscheduled active</div><div className="mt-1 text-2xl font-semibold text-violet-950">{unscheduled.length}</div></div>
      </section>

      {[...grouped.entries()].sort(([first], [second]) => first === "Unassigned" ? -1 : second === "Unassigned" ? 1 : first.localeCompare(second)).map(([driver, driverEntries]) => (
        <section key={driver} className="space-y-3">
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-zinc-950">{driver}</h2><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">{driverEntries.length}</span></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {driverEntries.map(({ load, dayStops, conflicts, missingAssignment, missingWindow, late, followUp }) => (
              <article key={load.id} className={`rounded-lg border bg-white p-4 ${late ? "border-red-300" : conflicts.length || missingAssignment || missingWindow ? "border-amber-300" : "border-zinc-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/loads/${load.id}`} className="font-semibold text-zinc-950 underline">Load {load.load_number}</Link><p className="text-xs text-zinc-500">{load.pickup_location} → {load.delivery_location}</p></div><StatusBadge status={load.status} /></div>
                <div className="mt-3 space-y-2">{dayStops.map((stop) => <div key={`${load.id}-${stop.position}`} className="rounded-md bg-zinc-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"><CalendarDays className="size-3.5" />{stop.stop_type}</div><div className="mt-1 font-medium text-zinc-900">{stop.location}</div><div className="mt-1 text-xs text-zinc-600">{formatStopWindow(stop)}</div>{stop.appointment_number ? <div className="mt-1 text-xs text-zinc-600">Appointment {stop.appointment_number}</div> : null}</div>)}</div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="font-semibold uppercase text-zinc-500">Equipment</dt><dd className="mt-1">{[load.truck_number ? `Truck ${load.truck_number}` : null, load.trailer_number ? `Trailer ${load.trailer_number}` : null].filter(Boolean).join(" · ") || "Unassigned"}</dd></div><div><dt className="font-semibold uppercase text-zinc-500">Follow-up</dt><dd className={`mt-1 font-semibold ${late ? "text-red-700" : "text-amber-800"}`}>{followUp}</dd></div></dl>
                {conflicts.length ? <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Conflicts with {conflicts.map((conflict) => `load ${conflict.loadNumber} (${conflict.resources.join(", ")})`).join("; ")}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ))}

      {!scheduled.length ? <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center"><h2 className="font-semibold text-zinc-950">No scheduled stops</h2><p className="mt-1 text-sm text-zinc-500">Choose another date or add appointment windows to active loads.</p></div> : null}

      {unscheduled.length ? <section className="space-y-3"><div><h2 className="text-lg font-semibold text-zinc-950">Unscheduled active loads</h2><p className="text-sm text-zinc-600">These loads have no stop date or appointment window and need dispatch follow-up.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{unscheduled.map(({ load }) => <Link key={load.id} href={`/loads/${load.id}/edit`} className="rounded-lg border border-violet-200 bg-violet-50 p-4"><div className="font-semibold text-violet-950">Load {load.load_number}</div><div className="mt-1 text-sm text-violet-800">{load.drivers?.name ?? "Unassigned driver"} · {load.truck_number ? `Truck ${load.truck_number}` : "No truck"}</div><div className="mt-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Add schedule →</div></Link>)}</div></section> : null}
    </div>
  );
}

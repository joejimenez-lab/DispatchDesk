import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/button";
import { Field, Input, Select } from "@/components/field";
import { FleetScopeTabs } from "@/components/fleet-scope-tabs";
import { LoadPaymentSelect } from "@/components/load-payment-select";
import { LoadStatusSelect } from "@/components/load-status-select";
import { getFormOptions } from "@/lib/data/options";
import { getLoadFleetCompanies } from "@/lib/data/fleet";
import { getLoads, isLoadClientPaymentPaid } from "@/lib/data/loads";
import { currency, formatDate } from "@/lib/utils";
import { loadCloseoutStatuses, loadStatuses } from "@/types/database";
import { closeoutReason } from "@/lib/load-lifecycle";
import { fleetScopeLabel, fleetScopeParam, parseFleetScope } from "@/lib/fleet-scope";
import { formatStopWindow, type DispatchStop } from "@/lib/dispatch";
import { financialCompleteness } from "@/lib/financials";

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; closeout?: string; broker?: string; driver?: string; payment?: string; financial?: string; fleet?: string }>;
}) {
  const params = await searchParams;
  const [options, fleetCompanies] = await Promise.all([getFormOptions(), getLoadFleetCompanies()]);
  const scope = parseFleetScope(params.fleet, fleetCompanies);
  if (!scope) notFound();
  const fleet = fleetScopeParam(scope);
  const loads = await getLoads({ ...params, fleetScope: scope });
  const exportParams = new URLSearchParams();
  if (params.q) exportParams.set("q", params.q);
  if (params.status) exportParams.set("status", params.status);
  if (params.closeout) exportParams.set("closeout", params.closeout);
  if (params.broker) exportParams.set("broker", params.broker);
  if (params.driver) exportParams.set("driver", params.driver);
  if (params.payment) exportParams.set("payment", params.payment);
  if (params.financial) exportParams.set("financial", params.financial);
  if (fleet) exportParams.set("fleet", fleet);
  const exportHref = `/api/loads/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;
  const roundTripSummary = (load: (typeof loads)[number]) =>
    load.is_round_trip ? `Returns to ${load.return_location || load.pickup_location}` : null;
  const stopOfType = (load: (typeof loads)[number], type: "Pickup" | "Delivery") =>
    load.load_stops.find((stop) => stop.stop_type === type);
  const linkedCell = (loadId: string, children: React.ReactNode, className = "") => (
    <td className={`p-0 ${className}`}>
      <Link href={`/loads/${loadId}`} className="block h-full px-4 py-3">
        {children}
      </Link>
    </td>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Loads</h1>
          <p className="text-sm text-zinc-600">{fleetScopeLabel(scope)} · Search, filter, and manage dispatch loads.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href={exportHref} variant="secondary">Export CSV</LinkButton>
          <LinkButton href="/loads/new">Create load</LinkButton>
        </div>
      </div>

      <FleetScopeTabs
        basePath="/loads"
        companies={fleetCompanies}
        scope={scope}
        params={{
          q: params.q,
          status: params.status,
          closeout: params.closeout,
          broker: params.broker,
          driver: params.driver,
          payment: params.payment,
          financial: params.financial,
        }}
      />

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-7">
        {fleet ? <input type="hidden" name="fleet" value={fleet} /> : null}
        <Field label="Search">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Load, city, carrier" />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={params.status ?? ""}>
            <option value="">All statuses</option>
            {loadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <Field label="Closeout">
          <Select name="closeout" defaultValue={params.closeout ?? ""}>
            <option value="">All stages</option>
            <option value="all-open">All open closeout</option>
            {loadCloseoutStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <Field label="Broker">
          <Select name="broker" defaultValue={params.broker ?? ""}>
            <option value="">All brokers</option>
            {options.brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.company_name}</option>)}
          </Select>
        </Field>
        <Field label="Driver">
          <Select name="driver" defaultValue={params.driver ?? ""}>
            <option value="">All drivers</option>
            {options.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
          </Select>
        </Field>
        <Field label="Payment">
          <Select name="payment" defaultValue={params.payment ?? ""}>
            <option value="">All payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid</option>
          </Select>
        </Field>
        <Field label="Financial data">
          <Select name="financial" defaultValue={params.financial ?? "all"}>
            <option value="all">All records</option>
            <option value="complete">Complete only</option>
            <option value="incomplete">Incomplete only</option>
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Filter</button>
          <Link href="/loads" className="flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">Reset</Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Load</th>
              <th className="px-4 py-3">Broker</th>
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Fleet / Equipment</th>
              <th className="px-4 py-3">Pickup</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Rate</th>
              <th className="min-w-36 px-4 py-3">Status and payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loads.map((load) => (
              <tr key={load.id} className="cursor-pointer hover:bg-zinc-50">
                {linkedCell(
                  load.id,
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{load.load_number}</span>
                      {load.is_round_trip ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Round trip</span>
                      ) : null}
                    </div>
                    {roundTripSummary(load) ? (
                      <div className="mt-1 text-xs font-medium text-amber-900">{roundTripSummary(load)}</div>
                    ) : null}
                    {load.is_round_trip && load.round_trip_details ? (
                      <div className="mt-1 max-w-64 truncate text-xs font-normal text-zinc-500">
                        Details: {load.round_trip_details}
                      </div>
                    ) : null}
                    {load.load_stops.length > 2 ? <div className="mt-1 text-xs font-medium text-violet-700">{load.load_stops.length} stops</div> : null}
                  </div>,
                  "font-semibold text-zinc-950",
                )}
                {linkedCell(load.id, load.brokers?.company_name ?? "Unassigned")}
                {linkedCell(load.id, load.drivers?.name ?? "Unassigned")}
                {linkedCell(
                  load.id,
                  <div className="min-w-32">
                    <div className="font-medium text-zinc-900">{load.fleet_company ?? "Unassigned"}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {[load.truck_number ? `Truck ${load.truck_number}` : null, load.trailer_number ? `Trailer ${load.trailer_number}` : null]
                        .filter(Boolean)
                        .join(" · ") || "No equipment"}
                    </div>
                  </div>,
                )}
                {linkedCell(
                  load.id,
                  <div className="min-w-40">
                    <div className="font-medium text-zinc-900">{stopOfType(load, "Pickup")?.location ?? load.pickup_location}</div>
                    <div className="mt-1 text-xs text-zinc-500">{stopOfType(load, "Pickup") ? formatStopWindow(stopOfType(load, "Pickup") as DispatchStop) : formatDate(load.pickup_date)}</div>
                  </div>,
                )}
                {linkedCell(
                  load.id,
                  <div className="min-w-40">
                    <div className="font-medium text-zinc-900">{stopOfType(load, "Delivery")?.location ?? load.delivery_location}</div>
                    <div className="mt-1 text-xs text-zinc-500">{stopOfType(load, "Delivery") ? formatStopWindow(stopOfType(load, "Delivery") as DispatchStop) : formatDate(load.delivery_date)}</div>
                    {roundTripSummary(load) ? (
                      <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                        {roundTripSummary(load)}
                      </div>
                    ) : null}
                  </div>,
                )}
                {linkedCell(load.id, <div>
                  <div>{currency(load.load_rate)}</div>
                  {financialCompleteness(load).complete ? (
                    <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Financials complete</span>
                  ) : (
                    <div className="mt-1">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Financials incomplete</span>
                      <div className="mt-1 text-xs text-amber-800">Missing {financialCompleteness(load).missingLabels.join(", ")}</div>
                    </div>
                  )}
                </div>)}
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <LoadStatusSelect loadId={load.id} status={load.status} closeoutStatus={load.post_delivery_status} />
                    {load.post_delivery_status ? (
                      <span className="max-w-40 rounded-full bg-amber-50 px-2.5 py-1 text-center text-xs font-semibold text-amber-800" title={closeoutReason(load.post_delivery_status)}>
                        {load.post_delivery_status}
                      </span>
                    ) : null}
                    <LoadPaymentSelect loadId={load.id} paid={isLoadClientPaymentPaid(load)} />
                  </div>
                </td>
              </tr>
            ))}
            {!loads.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <div className="text-sm font-medium text-zinc-900">No loads found</div>
                  <div className="mt-1 text-sm text-zinc-500">Adjust the filters or create a new load.</div>
                  <div className="mt-4 flex justify-center gap-2">
                    <Link href="/loads" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">Reset filters</Link>
                    <Link href="/loads/new" className="rounded-[10px] bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Create load</Link>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

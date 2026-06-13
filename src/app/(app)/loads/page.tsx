import Link from "next/link";
import { LinkButton } from "@/components/button";
import { Field, Input, Select } from "@/components/field";
import { StatusBadge } from "@/components/status-badge";
import { getFormOptions } from "@/lib/data/options";
import { getLoads } from "@/lib/data/loads";
import { currency, formatDate } from "@/lib/utils";
import { loadStatuses } from "@/types/database";

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; broker?: string; driver?: string }>;
}) {
  const params = await searchParams;
  const [loads, options] = await Promise.all([getLoads(params), getFormOptions()]);
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
          <p className="text-sm text-zinc-600">Search, filter, and manage dispatch loads.</p>
        </div>
        <LinkButton href="/loads/new">Create load</LinkButton>
      </div>

      <form className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-5">
        <Field label="Search">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Load, city, carrier" />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={params.status ?? ""}>
            <option value="">All statuses</option>
            {loadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
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
        <div className="flex items-end gap-2">
          <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">Filter</button>
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
              <th className="px-4 py-3">Lane</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loads.map((load) => (
              <tr key={load.id} className="cursor-pointer hover:bg-zinc-50">
                {linkedCell(load.id, load.load_number, "font-semibold text-zinc-950")}
                {linkedCell(load.id, load.brokers?.company_name ?? "Unassigned")}
                {linkedCell(load.id, load.drivers?.name ?? "Unassigned")}
                {linkedCell(load.id, `${load.pickup_location} to ${load.delivery_location}`)}
                {linkedCell(load.id, formatDate(load.delivery_date))}
                {linkedCell(load.id, currency(load.load_rate))}
                {linkedCell(load.id, <StatusBadge status={load.status} />)}
              </tr>
            ))}
            {!loads.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No loads found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { createUnit } from "@/lib/actions/fleet";
import { getUnits } from "@/lib/data/fleet";
import { unitTypes, type Database } from "@/types/database";

type Unit = Database["public"]["Tables"]["fleet_units"]["Row"];

function UnitGroup({ title, units }: { title: string; units: Unit[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          <p className="text-sm text-zinc-500">{units.length} {units.length === 1 ? "unit" : "units"}</p>
        </div>
      </div>
      {units.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <Link
              key={unit.id}
              href={`/fleet/${unit.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Unit</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-950">{unit.unit_number}</div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                  {unit.unit_type}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
                <div>
                  <div className="text-xs text-zinc-500">Company / Fleet</div>
                  <div className="mt-1 truncate text-sm font-medium text-zinc-800">{unit.company ?? "Not set"}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Odometer</div>
                  <div className="mt-1 text-sm font-medium text-zinc-800">
                    {unit.odometer != null ? `${unit.odometer.toLocaleString()} mi` : "Not set"}
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm font-medium text-zinc-500 transition group-hover:text-zinc-950">
                View unit <span aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center text-sm text-zinc-500">
          No {title.toLowerCase()} added yet.
        </p>
      )}
    </section>
  );
}

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const units = await getUnits(params.q);
  const trucks = units.filter((unit) => unit.unit_type === "Truck");
  const trailers = units.filter((unit) => unit.unit_type === "Trailer");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Fleet</h1>
          <p className="text-sm text-zinc-600">Manage trucks, trailers, and their maintenance history.</p>
        </div>
        <details className="group w-full rounded-xl border border-transparent open:border-zinc-200 open:bg-white open:p-5 sm:w-auto sm:min-w-36 open:sm:w-full">
          <summary className="cursor-pointer list-none rounded-md bg-zinc-950 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 group-open:mb-5 group-open:bg-zinc-100 group-open:text-zinc-700 group-open:shadow-none">
            <span className="group-open:hidden">+ Add unit</span>
            <span className="hidden group-open:inline">Cancel</span>
          </summary>
          <ActionForm action={createUnit} className="grid gap-4 md:grid-cols-3">
            <Field label="Unit Number"><Input name="unit_number" required /></Field>
            <Field label="Unit Type">
              <Select name="unit_type" defaultValue="Truck">
                {unitTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label="Company / Fleet"><Input name="company" /></Field>
            <Field label="Odometer"><Input type="number" min="0" name="odometer" /></Field>
            <Field label="Notes" className="md:col-span-3"><Textarea name="notes" /></Field>
            <SubmitButton className="md:w-fit" pendingText="Adding...">Add unit</SubmitButton>
          </ActionForm>
        </details>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-zinc-500">Total units</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-950">{units.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-zinc-500">Trucks</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-950">{trucks.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-zinc-500">Trailers</div>
          <div className="mt-1 text-2xl font-semibold text-zinc-950">{trailers.length}</div>
        </div>
      </div>

      <form className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <Field label="Search fleet" className="flex-1">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Search by unit number or company" />
        </Field>
        <button type="submit" className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800">
          Search
        </button>
        {params.q ? (
          <Link href="/fleet" className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
            Clear
          </Link>
        ) : null}
      </form>

      <UnitGroup title="Trucks" units={trucks} />
      <UnitGroup title="Trailers" units={trailers} />
    </div>
  );
}

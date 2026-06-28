import { ActionForm } from "@/components/action-form";
import { DetailsCloseButton } from "@/components/details-close-button";
import { Field, Input, Textarea } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import { createDriver, deleteDriver, updateDriver } from "@/lib/actions/drivers";
import { getDrivers } from "@/lib/data/contacts";

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-950">{value?.trim() || "Not set"}</div>
    </div>
  );
}

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const drivers = await getDrivers(params.q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Drivers</h1>
          <p className="text-sm text-zinc-600">Maintain driver, truck, and trailer records.</p>
        </div>
        <details className="group w-full sm:w-auto open:sm:w-full">
          <summary className="cursor-pointer list-none rounded-md bg-zinc-950 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800">
            <span className="group-open:hidden">+ Add driver</span>
            <span className="hidden group-open:inline">Cancel</span>
          </summary>
          <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Add Driver</h2>
            <ActionForm action={createDriver} className="grid gap-4 md:grid-cols-3">
              <Field label="Driver Name"><Input name="name" required /></Field>
              <Field label="Phone"><Input name="phone" /></Field>
              <Field label="Email"><Input type="email" name="email" /></Field>
              <Field label="Truck Number"><Input name="truck_number" /></Field>
              <Field label="Trailer Number"><Input name="trailer_number" /></Field>
              <Field label="Notes" className="md:col-span-3"><Textarea name="notes" /></Field>
              <SubmitButton className="md:w-fit" pendingText="Adding...">Add driver</SubmitButton>
            </ActionForm>
          </section>
        </details>
      </div>

      <form className="rounded-lg border border-zinc-200 bg-white p-4">
        <Field label="Search Drivers">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Name, phone, email, truck" />
        </Field>
      </form>

      <section className="space-y-3">
        {drivers.map((driver) => (
          <article key={driver.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">{driver.name}</h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {[driver.truck_number ? `Truck ${driver.truck_number}` : null, driver.trailer_number ? `Trailer ${driver.trailer_number}` : null]
                    .filter(Boolean)
                    .join(" / ") || "No truck or trailer assigned"}
                </p>
              </div>
              <details className="group shrink-0 open:w-full">
                <summary className="ml-auto w-fit cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  <span className="group-open:hidden">Edit</span>
                  <span className="hidden group-open:inline">Close edit</span>
                </summary>
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
                  <ActionForm action={updateDriver.bind(null, driver.id)} className="grid gap-3 md:grid-cols-6">
                    <Field label="Name"><Input name="name" required defaultValue={driver.name} /></Field>
                    <Field label="Phone"><Input name="phone" defaultValue={driver.phone ?? ""} /></Field>
                    <Field label="Email"><Input name="email" defaultValue={driver.email ?? ""} /></Field>
                    <Field label="Truck"><Input name="truck_number" defaultValue={driver.truck_number ?? ""} /></Field>
                    <Field label="Trailer"><Input name="trailer_number" defaultValue={driver.trailer_number ?? ""} /></Field>
                    <div className="flex items-end">
                      <SubmitButton variant="secondary">Save</SubmitButton>
                    </div>
                    <Field label="Notes" className="md:col-span-6"><Textarea name="notes" defaultValue={driver.notes ?? ""} /></Field>
                  </ActionForm>
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <ActionForm action={deleteDriver.bind(null, driver.id)} successMessage={false}>
                      <ConfirmSubmitButton
                        message={`Delete driver ${driver.name}? Loads assigned to this driver will become unassigned.`}
                        variant="danger"
                      >
                        Delete driver
                      </ConfirmSubmitButton>
                    </ActionForm>
                  </div>
                </div>
              </details>
            </div>
            <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
              <DetailItem label="Phone" value={driver.phone} />
              <DetailItem label="Email" value={driver.email} />
              <DetailItem label="Truck" value={driver.truck_number} />
              <DetailItem label="Trailer" value={driver.trailer_number} />
              <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{driver.notes?.trim() || "No notes"}</p>
              </div>
            </div>
          </article>
        ))}
        {!drivers.length ? <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No drivers found.</p> : null}
      </section>
    </div>
  );
}

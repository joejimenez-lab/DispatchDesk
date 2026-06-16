import { ActionForm } from "@/components/action-form";
import { Field, Input, Textarea } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import { createDriver, deleteDriver, updateDriver } from "@/lib/actions/drivers";
import { getDrivers } from "@/lib/data/contacts";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const drivers = await getDrivers(params.q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Drivers</h1>
        <p className="text-sm text-zinc-600">Maintain driver, truck, and trailer records.</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
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

      <form className="rounded-lg border border-zinc-200 bg-white p-4">
        <Field label="Search Drivers">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Name, phone, email, truck" />
        </Field>
      </form>

      <section className="space-y-3">
        {drivers.map((driver) => (
          <div key={driver.id} className="rounded-lg border border-zinc-200 bg-white p-4">
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
            <ActionForm action={deleteDriver.bind(null, driver.id)} className="mt-3">
              <ConfirmSubmitButton
                message={`Delete driver ${driver.name}? Loads assigned to this driver will become unassigned.`}
                variant="danger"
              >
                Delete
              </ConfirmSubmitButton>
            </ActionForm>
          </div>
        ))}
        {!drivers.length ? <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No drivers found.</p> : null}
      </section>
    </div>
  );
}

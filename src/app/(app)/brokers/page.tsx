import { Button } from "@/components/button";
import { Field, Input, Textarea } from "@/components/field";
import { createBroker, deleteBroker, updateBroker } from "@/lib/actions/brokers";
import { getBrokers } from "@/lib/data/contacts";

export default async function BrokersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const brokers = await getBrokers(params.q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950">Brokers</h1>
        <p className="text-sm text-zinc-600">Maintain broker and customer contact records.</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Add Broker</h2>
        <form action={createBroker} className="grid gap-4 md:grid-cols-3">
          <Field label="Company Name"><Input name="company_name" required /></Field>
          <Field label="Contact Name"><Input name="contact_name" /></Field>
          <Field label="Phone"><Input name="phone" /></Field>
          <Field label="Email"><Input type="email" name="email" /></Field>
          <Field label="Notes" className="md:col-span-3"><Textarea name="notes" /></Field>
          <Button type="submit" className="md:w-fit">Add broker</Button>
        </form>
      </section>

      <form className="rounded-lg border border-zinc-200 bg-white p-4">
        <Field label="Search Brokers">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Company, contact, phone, email" />
        </Field>
      </form>

      <section className="space-y-3">
        {brokers.map((broker) => (
          <form key={broker.id} action={updateBroker.bind(null, broker.id)} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-5">
            <Field label="Company"><Input name="company_name" required defaultValue={broker.company_name} /></Field>
            <Field label="Contact"><Input name="contact_name" defaultValue={broker.contact_name ?? ""} /></Field>
            <Field label="Phone"><Input name="phone" defaultValue={broker.phone ?? ""} /></Field>
            <Field label="Email"><Input name="email" defaultValue={broker.email ?? ""} /></Field>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="secondary">Save</Button>
              <Button formAction={deleteBroker.bind(null, broker.id)} variant="danger">Delete</Button>
            </div>
            <Field label="Notes" className="md:col-span-5"><Textarea name="notes" defaultValue={broker.notes ?? ""} /></Field>
          </form>
        ))}
        {!brokers.length ? <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No brokers found.</p> : null}
      </section>
    </div>
  );
}

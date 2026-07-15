import { ActionForm } from "@/components/action-form";
import { DetailsCloseButton } from "@/components/details-close-button";
import { Field, Input, Textarea } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import { createBroker, deleteBroker, updateBroker } from "@/lib/actions/brokers";
import { getBrokers } from "@/lib/data/contacts";

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-950">{value?.trim() || "Not set"}</div>
    </div>
  );
}

export default async function BrokersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const brokers = await getBrokers(params.q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Brokers</h1>
          <p className="text-sm text-zinc-600">Maintain broker and customer contact records.</p>
        </div>
        <details className="group w-full sm:w-auto open:sm:w-full">
          <summary className="cursor-pointer list-none rounded-[10px] bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <span className="group-open:hidden">+ Add broker</span>
            <span className="hidden group-open:inline">Cancel</span>
          </summary>
          <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Add Broker</h2>
            <ActionForm action={createBroker} className="grid gap-4 md:grid-cols-3">
              <Field label="Company Name"><Input name="company_name" required /></Field>
              <Field label="Contact Name"><Input name="contact_name" /></Field>
              <Field label="Phone"><Input name="phone" /></Field>
              <Field label="Email"><Input type="email" name="email" /></Field>
              <Field label="Notes" className="md:col-span-3"><Textarea name="notes" /></Field>
              <SubmitButton className="md:w-fit" pendingText="Adding...">Add broker</SubmitButton>
            </ActionForm>
          </section>
        </details>
      </div>

      <form className="rounded-lg border border-zinc-200 bg-white p-4">
        <Field label="Search Brokers">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Company, contact, phone, email" />
        </Field>
      </form>

      <section className="space-y-3">
        {brokers.map((broker) => (
          <article key={broker.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">{broker.company_name}</h2>
                <p className="mt-0.5 text-sm text-zinc-600">{broker.contact_name?.trim() || "No contact name"}</p>
              </div>
              <details className="group shrink-0 open:w-full">
                <summary className="ml-auto w-fit cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  <span className="group-open:hidden">Edit</span>
                  <span className="hidden group-open:inline">Close edit</span>
                </summary>
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
                  <ActionForm action={updateBroker.bind(null, broker.id)} className="grid gap-3 md:grid-cols-5">
                    <Field label="Company"><Input name="company_name" required defaultValue={broker.company_name} /></Field>
                    <Field label="Contact"><Input name="contact_name" defaultValue={broker.contact_name ?? ""} /></Field>
                    <Field label="Phone"><Input name="phone" defaultValue={broker.phone ?? ""} /></Field>
                    <Field label="Email"><Input name="email" defaultValue={broker.email ?? ""} /></Field>
                    <div className="flex items-end">
                      <SubmitButton variant="secondary">Save</SubmitButton>
                    </div>
                    <Field label="Notes" className="md:col-span-5"><Textarea name="notes" defaultValue={broker.notes ?? ""} /></Field>
                  </ActionForm>
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <ActionForm action={deleteBroker.bind(null, broker.id)} successMessage={false}>
                      <ConfirmSubmitButton
                        message={`Delete broker ${broker.company_name}? Loads assigned to this broker will become unassigned.`}
                        variant="danger"
                      >
                        Delete broker
                      </ConfirmSubmitButton>
                    </ActionForm>
                  </div>
                </div>
              </details>
            </div>
            <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Contact" value={broker.contact_name} />
              <DetailItem label="Phone" value={broker.phone} />
              <DetailItem label="Email" value={broker.email} />
              <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                <div className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{broker.notes?.trim() || "No notes"}</p>
              </div>
            </div>
          </article>
        ))}
        {!brokers.length ? <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No brokers found.</p> : null}
      </section>
    </div>
  );
}

import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { LinkButton } from "@/components/button";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { addCollectionContact, addReceivableEntry, updateInvoiceCollection } from "@/lib/actions/collections";
import { getCollectionDetail } from "@/lib/data/collections";
import { currency, formatDate } from "@/lib/utils";

function today() { return new Date().toISOString().slice(0, 10); }
function localDateTime() { const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); }

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { load, payment, entries, contacts, owners, balance } = await getCollectionDetail(id);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Link href="/collections" className="text-sm font-semibold text-[#6757e8]">← Collections</Link><h1 className="mt-2 text-2xl font-semibold text-zinc-950">Invoice {payment.invoice_number ?? load.load_number}</h1><p className="text-sm text-zinc-600">Load <Link className="underline" href={`/loads/${id}`}>{load.load_number}</Link> · {load.brokers?.company_name ?? "Unassigned customer"}</p></div><div className="text-right"><div className="text-xs font-semibold uppercase text-zinc-500">Outstanding</div><div className="text-3xl font-semibold text-zinc-950">{currency(balance)}</div></div></div>

    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-zinc-200 bg-white p-5"><h2 className="text-lg font-semibold">Invoice and ownership</h2>
        <ActionForm action={updateInvoiceCollection.bind(null, id)} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Invoice status"><Select name="invoice_status" defaultValue={payment.invoice_status}><option>Draft</option><option>Sent</option><option>Void</option></Select></Field>
          <Field label="Invoice number"><Input name="invoice_number" defaultValue={payment.invoice_number ?? ""}/></Field>
          <Field label="Invoice date"><Input type="date" name="invoice_date" defaultValue={payment.invoice_date ?? ""}/></Field>
          <Field label="Payment terms (days)"><Input type="number" min="0" max="365" name="payment_terms_days" defaultValue={payment.payment_terms_days}/></Field>
          <Field label="Due date"><Input type="date" name="due_date" defaultValue={payment.due_date ?? ""}/></Field>
          <Field label="Collection owner"><Select name="collection_owner_id" defaultValue={payment.collection_owner_id ?? ""}><option value="">Unassigned</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name || owner.email}</option>)}</Select></Field>
          <Field label="Next follow-up"><Input type="date" name="next_follow_up_date" defaultValue={payment.next_follow_up_date ?? ""}/></Field>
          <div className="flex items-end"><SubmitButton>Save invoice</SubmitButton></div>
        </ActionForm>
        <p className="mt-3 text-xs text-zinc-500">When due date is blank, invoice date + payment terms is used. Draft invoices without an explicit date remain undated.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5"><h2 className="text-lg font-semibold">Record financial entry</h2><p className="mt-1 text-sm text-zinc-500">Entries are permanent for a complete audit trail.</p>
        {payment.invoice_status === "Void" ? <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">This invoice is void. Reopen it before recording another financial entry.</p> : <ActionForm action={addReceivableEntry.bind(null, id)} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Entry type"><Select name="entry_type"><option>Payment</option><option>Adjustment</option><option>Credit</option><option>Write-off</option></Select></Field>
          <Field label="Amount"><Input type="number" step="0.01" name="amount" required/></Field>
          <Field label="Entry date"><Input type="date" name="entry_date" defaultValue={today()} required/></Field>
          <Field label="Reference / reason"><Input name="note" placeholder="ACH reference, approval, or reason"/></Field>
          <p className="text-xs text-zinc-500 sm:col-span-2">Positive adjustments add charges; negative adjustments reduce the balance. Credits and write-offs require a reason.</p>
          <div><SubmitButton>Record entry</SubmitButton></div>
        </ActionForm>}
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <div className="dispatch-panel"><div className="panel-heading"><div><h2>Receivable ledger</h2><p>Original rate {currency(load.load_rate)} · reconciled balance {currency(balance)}</p></div></div><div className="divide-y divide-zinc-200 px-5">
        {entries.map((entry) => <div key={entry.id} className="flex justify-between gap-4 py-3"><div><div className="font-semibold text-zinc-950">{entry.entry_type}</div><div className="text-xs text-zinc-500">{formatDate(entry.entry_date)} · {entry.note || "No reference"}</div><div className="text-xs text-zinc-400">{entry.created_by_email ?? "Historical import"}</div></div><div className="font-semibold">{entry.entry_type === "Adjustment" && entry.amount > 0 ? "+" : entry.entry_type === "Adjustment" ? "−" : "−"}{currency(Math.abs(entry.amount))}</div></div>)}
        {!entries.length ? <p className="py-4 text-sm text-zinc-500">No payments or adjustments recorded.</p> : null}
      </div></div>

      <div className="dispatch-panel"><div className="panel-heading"><div><h2>Contact history</h2><p>Collection notes, calls, emails, and promised follow-ups.</p></div></div><div className="p-5">
        <ActionForm action={addCollectionContact.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact type"><Select name="contact_type"><option>Note</option><option>Phone</option><option>Email</option></Select></Field>
          <Field label="Contacted at"><Input type="datetime-local" name="contacted_at" defaultValue={localDateTime()} required/></Field>
          <Field label="Note" className="sm:col-span-2"><Textarea name="note" required placeholder="Who was contacted, outcome, and commitment"/></Field>
          <Field label="Next follow-up"><Input type="date" name="next_follow_up_date" defaultValue={payment.next_follow_up_date ?? ""}/></Field>
          <div className="flex items-end"><SubmitButton>Log contact</SubmitButton></div>
        </ActionForm>
        <div className="mt-5 divide-y divide-zinc-200">{contacts.map((contact) => <div key={contact.id} className="py-3"><div className="flex justify-between gap-3"><span className="font-semibold text-zinc-950">{contact.contact_type}</span><span className="text-xs text-zinc-500">{new Date(contact.contacted_at).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{contact.note}</p><div className="mt-1 text-xs text-zinc-400">{contact.created_by_email ?? "Unknown user"}</div></div>)}</div>
      </div></div>
    </section>
    <LinkButton href={`/loads/${id}`} variant="secondary">Back to load</LinkButton>
  </div>;
}

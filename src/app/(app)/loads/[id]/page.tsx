import Link from "next/link";
import { Button, LinkButton } from "@/components/button";
import { Field, Select, Textarea } from "@/components/field";
import { StatusBadge } from "@/components/status-badge";
import { addNote, deleteDocument, deleteLoad, updatePaymentFlag, uploadDocument } from "@/lib/actions/loads";
import { getLoad, getLoadRelated } from "@/lib/data/loads";
import { currency, formatDate } from "@/lib/utils";
import { documentCategories } from "@/types/database";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-950">{value}</dd>
    </div>
  );
}

function PaymentToggle({
  label,
  amount,
  paid,
  loadId,
  field,
}: {
  label: string;
  amount?: React.ReactNode;
  paid: boolean;
  loadId: string;
  field: "client_paid" | "driver_paid" | "dispatcher_paid";
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-950">
        <form action={updatePaymentFlag.bind(null, loadId, field, true)}>
          <button
            type="submit"
            className={`h-8 rounded-md px-3 text-sm font-semibold ring-1 ${
              paid
                ? "bg-green-600 text-white ring-green-600"
                : "bg-white text-zinc-700 ring-zinc-300 hover:bg-green-50"
            }`}
          >
            Yes
          </button>
        </form>
        <form action={updatePaymentFlag.bind(null, loadId, field, false)}>
          <button
            type="submit"
            className={`h-8 rounded-md px-3 text-sm font-semibold ring-1 ${
              !paid
                ? "bg-red-600 text-white ring-red-600"
                : "bg-white text-zinc-700 ring-zinc-300 hover:bg-red-50"
            }`}
          >
            No
          </button>
        </form>
        {amount ? <span className="text-zinc-500">{amount}</span> : null}
      </dd>
    </div>
  );
}

export default async function LoadDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [load, related] = await Promise.all([getLoad(id), getLoadRelated(id)]);
  const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
  const profit = Number(load.load_rate) - Number(load.driver_pay) - Number(load.dispatcher_fee) - Number(load.fuel_cost);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-950">Load {load.load_number}</h1>
            <StatusBadge status={load.status} />
          </div>
          <p className="text-sm text-zinc-600">{load.pickup_location} to {load.delivery_location}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href={`/loads/${id}/edit`} variant="secondary">Edit</LinkButton>
          <form action={deleteLoad.bind(null, id)}>
            <Button type="submit" variant="danger">Delete</Button>
          </form>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">Load Details</h2>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Broker" value={load.brokers?.company_name ?? "Unassigned"} />
            <Detail label="Broker Contact" value={load.brokers?.contact_name ?? "Not set"} />
            <Detail label="Carrier" value={load.carrier_company ?? "Not set"} />
            <Detail label="Driver" value={load.drivers?.name ?? "Unassigned"} />
            <Detail label="Truck" value={load.drivers?.truck_number ?? "Not set"} />
            <Detail label="Trailer" value={load.drivers?.trailer_number ?? "Not set"} />
            <Detail label="Pickup Date" value={formatDate(load.pickup_date)} />
            <Detail label="Delivery Date" value={formatDate(load.delivery_date)} />
            <Detail label="Created" value={new Date(load.created_at).toLocaleString()} />
          </dl>
          {load.notes ? (
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <h3 className="text-sm font-semibold text-zinc-950">Load Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{load.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">Financial Summary</h2>
          <dl className="space-y-3">
            <Detail label="Load Rate" value={currency(load.load_rate)} />
            <Detail label="Driver Pay" value={currency(load.driver_pay)} />
            <Detail label="Dispatcher Fee" value={currency(load.dispatcher_fee)} />
            <Detail label="Fuel Cost" value={currency(load.fuel_cost)} />
            <Detail label="Profit" value={<span className={profit >= 0 ? "text-green-700" : "text-red-700"}>{currency(profit)}</span>} />
            <PaymentToggle
              label="Client Paid"
              loadId={id}
              field="client_paid"
              paid={Boolean(payment?.client_paid)}
              amount={payment?.client_paid ? currency(payment.client_amount_received) : undefined}
            />
            <PaymentToggle
              label="Driver Paid"
              loadId={id}
              field="driver_paid"
              paid={Boolean(payment?.driver_paid)}
              amount={payment?.driver_paid ? currency(payment.driver_amount_paid) : undefined}
            />
            <PaymentToggle
              label="Dispatcher Paid"
              loadId={id}
              field="dispatcher_paid"
              paid={Boolean(payment?.dispatcher_paid)}
              amount={payment?.dispatcher_paid ? currency(payment.dispatcher_fee_amount) : undefined}
            />
          </dl>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">Documents</h2>
          <form action={uploadDocument} className="mb-5 grid gap-3">
            <input type="hidden" name="load_id" value={id} />
            <Field label="Category">
              <Select name="category">
                {documentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </Select>
            </Field>
            <Field label="Document">
              <input name="file" type="file" required className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" />
            </Field>
            <Button type="submit">Upload document</Button>
          </form>
          <div className="divide-y divide-zinc-100">
            {related.documents.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium text-zinc-950">{document.file_name}</div>
                  <div className="text-xs text-zinc-500">{document.category} · {new Date(document.created_at).toLocaleString()}</div>
                  {document.notes ? <p className="mt-1 text-sm text-zinc-600">{document.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/api/documents/${document.id}/view`}
                    target="_blank"
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium"
                  >
                    View
                  </Link>
                  <Link href={`/api/documents/${document.id}/download`} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">
                    Download
                  </Link>
                  <form action={deleteDocument.bind(null, document.id, id, document.storage_path)}>
                    <Button type="submit" variant="secondary">Delete</Button>
                  </form>
                </div>
              </div>
            ))}
            {!related.documents.length ? <p className="py-4 text-sm text-zinc-500">No documents uploaded.</p> : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Notes</h2>
            <form action={addNote} className="mb-4 space-y-3">
              <input type="hidden" name="load_id" value={id} />
              <Field label="New Note">
                <Textarea name="note_text" required />
              </Field>
              <Button type="submit">Add note</Button>
            </form>
            <div className="divide-y divide-zinc-100">
              {related.notes.map((note) => (
                <div key={note.id} className="py-3">
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">{note.note_text}</p>
                  <p className="mt-1 text-xs text-zinc-500">{new Date(note.created_at).toLocaleString()}</p>
                </div>
              ))}
              {!related.notes.length ? <p className="py-4 text-sm text-zinc-500">No notes yet.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Activity Log</h2>
            <div className="divide-y divide-zinc-100">
              {related.activity.map((entry) => (
                <div key={entry.id} className="py-3">
                  <p className="text-sm font-medium text-zinc-800">{entry.action}</p>
                  <p className="mt-1 text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

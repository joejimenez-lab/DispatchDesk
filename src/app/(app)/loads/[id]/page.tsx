import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { LinkButton } from "@/components/button";
import { Field, Select, Textarea } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import { StatusBadge } from "@/components/status-badge";
import { addNote, deleteDocument, deleteLoad, updatePaymentFlag, uploadDocument } from "@/lib/actions/loads";
import { getLoad, getLoadRelated } from "@/lib/data/loads";
import { clientCollected, clientOutstanding, profitForLoad } from "@/lib/financials";
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
  detail,
  paid,
  loadId,
  field,
}: {
  label: string;
  amount?: React.ReactNode;
  detail?: React.ReactNode;
  paid: boolean;
  loadId: string;
  field: "invoice_sent" | "client_paid" | "driver_paid" | "dispatcher_paid";
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-950">
        <ActionForm action={updatePaymentFlag.bind(null, loadId, field, true)} successMessage={false}>
          <SubmitButton
            className="h-8 px-3"
            pendingText="..."
            variant={paid ? "primary" : "secondary"}
          >
            Yes
          </SubmitButton>
        </ActionForm>
        <ActionForm action={updatePaymentFlag.bind(null, loadId, field, false)} successMessage={false}>
          <SubmitButton
            className="h-8 px-3"
            pendingText="..."
            variant={!paid ? "danger" : "secondary"}
          >
            No
          </SubmitButton>
        </ActionForm>
        {amount ? <span className="text-zinc-500">{amount}</span> : null}
        {detail ? <span className="basis-full text-xs text-zinc-500">{detail}</span> : null}
      </dd>
    </div>
  );
}

export default async function LoadDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [load, related] = await Promise.all([getLoad(id), getLoadRelated(id)]);
  const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
  const profit = profitForLoad(load);
  const collected = clientCollected(load.load_rate, payment);
  const outstanding = load.status === "Cancelled" ? 0 : clientOutstanding(load.load_rate, payment);
  const returnLocation = load.return_location || load.pickup_location;
  const laneSummary = load.is_round_trip
    ? `${load.pickup_location} to ${load.delivery_location} and returns to ${returnLocation}`
    : `${load.pickup_location} to ${load.delivery_location}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-950">Load {load.load_number}</h1>
            <StatusBadge status={load.status} />
            {load.is_round_trip ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                Round trip
              </span>
            ) : null}
          </div>
          <p className="text-sm text-zinc-600">{laneSummary}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href={`/loads/${id}/edit`} variant="secondary">Edit</LinkButton>
          <ActionForm action={deleteLoad.bind(null, id)} successMessage={false}>
            <ConfirmSubmitButton
              message={`Delete load ${load.load_number}? This also removes its notes, activity, payment record, and uploaded documents.`}
              variant="danger"
            >
              Delete
            </ConfirmSubmitButton>
          </ActionForm>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">Load Details</h2>
          {load.is_round_trip ? (
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Round trip return</div>
              <div className="mt-1 text-sm font-semibold text-amber-950">Returns to {returnLocation}</div>
              <div className="mt-1 text-xs text-amber-900">
                Outbound delivery is {load.delivery_location}; return destination can be a different city.
              </div>
              {load.round_trip_details ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-amber-950">{load.round_trip_details}</p>
              ) : null}
            </div>
          ) : null}
          <dl className={`mb-5 grid gap-3 ${load.is_round_trip ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pickup</dt>
              <dd className="mt-2 break-words font-semibold text-zinc-950">{load.pickup_location}</dd>
              <dd className="mt-1 text-sm text-zinc-600">{formatDate(load.pickup_date)}</dd>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Delivery</dt>
              <dd className="mt-2 break-words font-semibold text-zinc-950">{load.delivery_location}</dd>
              <dd className="mt-1 text-sm text-zinc-600">{formatDate(load.delivery_date)}</dd>
            </div>
            {load.is_round_trip ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-amber-800">Return</dt>
                <dd className="mt-2 break-words font-semibold text-amber-950">{returnLocation}</dd>
                <dd className="mt-1 text-sm text-amber-900">After delivery</dd>
              </div>
            ) : null}
          </dl>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Broker" value={load.brokers?.company_name ?? "Unassigned"} />
            <Detail label="Broker Contact" value={load.brokers?.contact_name ?? "Not set"} />
            <Detail label="Carrier" value={load.carrier_company ?? "Not set"} />
            <Detail label="Driver" value={load.drivers?.name ?? "Unassigned"} />
            <Detail label="Truck" value={load.drivers?.truck_number ?? "Not set"} />
            <Detail label="Trailer" value={load.drivers?.trailer_number ?? "Not set"} />
            <Detail label="Round Trip" value={load.is_round_trip ? "Yes" : "No"} />
            <Detail label="Created" value={new Date(load.created_at).toLocaleString()} />
          </dl>
          {load.notes ? (
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <h3 className="text-sm font-semibold text-zinc-950">Load Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{load.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Documentation</h2>
            <dl className="space-y-3">
              <PaymentToggle
                label="Invoice Sent"
                loadId={id}
                field="invoice_sent"
                paid={Boolean(payment?.invoice_sent)}
                detail={payment?.invoice_sent_date ? formatDate(payment.invoice_sent_date) : undefined}
              />
            </dl>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Financial Summary</h2>
            <dl className="space-y-3">
              <Detail label="Load Rate" value={currency(load.load_rate)} />
              <Detail label="Driver Pay" value={currency(load.driver_pay)} />
              <Detail label="Dispatcher Fee" value={currency(load.dispatcher_fee)} />
              <Detail label="Fuel Cost" value={currency(load.fuel_cost)} />
              <Detail label="Profit" value={<span className={profit >= 0 ? "text-green-700" : "text-red-700"}>{currency(profit)}</span>} />
              <Detail label="Client Collected" value={currency(collected)} />
              <Detail label="Client Outstanding" value={currency(outstanding)} />
              <PaymentToggle
                label="Client Paid"
                loadId={id}
                field="client_paid"
                paid={Boolean(payment?.client_paid)}
                amount={`${currency(collected)} received`}
                detail={`${currency(outstanding)} outstanding`}
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
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">Documents</h2>
          <ActionForm action={uploadDocument} className="mb-5 grid gap-3">
            <input type="hidden" name="load_id" value={id} />
            <Field label="Category">
              <Select name="category">
                {documentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </Select>
            </Field>
            <Field label="Document">
              <input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/heic,image/heif,.pdf,.png,.jpg,.jpeg,.heic,.heif" required className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" />
            </Field>
            <SubmitButton pendingText="Uploading...">Upload document</SubmitButton>
          </ActionForm>
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
                  <ActionForm action={deleteDocument.bind(null, document.id, id, document.storage_path)} successMessage={false}>
                    <ConfirmSubmitButton
                      message={`Delete document ${document.file_name}?`}
                      variant="secondary"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </ActionForm>
                </div>
              </div>
            ))}
            {!related.documents.length ? <p className="py-4 text-sm text-zinc-500">No documents uploaded.</p> : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Notes</h2>
            <ActionForm action={addNote} className="mb-4 space-y-3">
              <input type="hidden" name="load_id" value={id} />
              <Field label="New Note">
                <Textarea name="note_text" required />
              </Field>
              <SubmitButton pendingText="Adding...">Add note</SubmitButton>
            </ActionForm>
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

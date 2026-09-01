import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { LinkButton } from "@/components/button";
import { Field, Select, Textarea } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import { StatusBadge } from "@/components/status-badge";
import { addNote, deleteDocument, deleteLoad, updateLoadCloseout, updatePaymentFlag, uploadDocument } from "@/lib/actions/loads";
import { getAssignmentWindows, getLoad, getLoadRelated } from "@/lib/data/loads";
import { clientCollected, financialCompleteness, profitForLoad, totalDeductionsForLoad } from "@/lib/financials";
import { currency, formatDate } from "@/lib/utils";
import { documentCategories } from "@/types/database";
import { findAssignmentConflicts, formatStopWindow, type DispatchStop } from "@/lib/dispatch";
import { closeoutReason } from "@/lib/load-lifecycle";
import { receivableBalance } from "@/lib/collections";

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
  const [load, related, assignmentWindows] = await Promise.all([getLoad(id), getLoadRelated(id), getAssignmentWindows()]);
  const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
  const profit = profitForLoad(load);
  const completeness = financialCompleteness(load);
  const totalDeductions = totalDeductionsForLoad(load);
  const collected = clientCollected(load.load_rate, payment);
  const outstanding = load.status === "Cancelled" || payment?.invoice_status === "Void" ? 0 : receivableBalance(load.load_rate, load.receivable_entries);
  const returnLocation = load.return_location || load.pickup_location;
  const laneSummary = load.is_round_trip
    ? `${load.pickup_location} to ${load.delivery_location} and returns to ${returnLocation}`
    : `${load.pickup_location} to ${load.delivery_location}`;
  const conflicts = findAssignmentConflicts(
    { driverId: load.driver_id, truckUnitId: load.truck_unit_id, trailerUnitId: load.trailer_unit_id },
    load.load_stops as DispatchStop[],
    assignmentWindows,
    load.id,
  );

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

      {conflicts.length ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">Assignment conflicts</h2>
          <p className="mt-1 text-sm text-amber-900">This load overlaps another active assignment. The warning is advisory.</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
            {conflicts.map((conflict) => <li key={conflict.loadId}><Link className="font-semibold underline" href={`/loads/${conflict.loadId}`}>Load {conflict.loadNumber}</Link>: {conflict.resources.join(", ")}</li>)}
          </ul>
        </section>
      ) : null}

      {load.status === "Delivered" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Post-delivery closeout</div>
              <h2 className="mt-1 text-lg font-semibold text-amber-950">{load.post_delivery_status ?? "Awaiting Documents"}</h2>
              <p className="mt-1 text-sm text-amber-900">{closeoutReason(load.post_delivery_status)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={updateLoadCloseout.bind(null, id, "documents_complete", !load.documents_complete_at)} successMessage={false}>
                <SubmitButton variant="secondary" pendingText="Updating...">
                  {load.documents_complete_at ? "Mark documents incomplete" : "Mark documents complete"}
                </SubmitButton>
              </ActionForm>
              {load.post_delivery_status === "Paid" ? (
                <ActionForm action={updateLoadCloseout.bind(null, id, "closed", true)} successMessage={false}>
                  <SubmitButton pendingText="Closing...">Close load</SubmitButton>
                </ActionForm>
              ) : null}
              {load.post_delivery_status === "Closed" ? (
                <ActionForm action={updateLoadCloseout.bind(null, id, "closed", false)} successMessage={false}>
                  <SubmitButton variant="secondary" pendingText="Reopening...">Reopen closeout</SubmitButton>
                </ActionForm>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-amber-800">
            <span>Documents: {load.documents_complete_at ? new Date(load.documents_complete_at).toLocaleString() : "Incomplete"}</span>
            <span>Closed: {load.closed_at ? new Date(load.closed_at).toLocaleString() : "Not closed"}</span>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">Load Details</h2>
          <div className="mb-5 space-y-3">
            {load.load_stops.map((stop, index) => (
              <article key={stop.id} className={`rounded-md border p-4 ${stop.stop_type === "Return" ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Stop {index + 1} · {stop.stop_type}</div>
                  <div className="text-xs font-medium text-zinc-600">{formatStopWindow(stop as DispatchStop)}</div>
                </div>
                <div className="mt-2 break-words font-semibold text-zinc-950">{stop.location}</div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600">
                  {stop.appointment_number ? <span>Appointment: {stop.appointment_number}</span> : null}
                  {stop.reference_number ? <span>Reference: {stop.reference_number}</span> : null}
                </div>
                {stop.instructions ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{stop.instructions}</p> : null}
              </article>
            ))}
          </div>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Broker" value={load.brokers?.company_name ?? "Unassigned"} />
            <Detail label="Broker Contact" value={load.brokers?.contact_name ?? "Not set"} />
            <Detail label="Carrier" value={load.carrier_company ?? "Not set"} />
            <Detail label="Driver" value={load.drivers?.name ?? "Unassigned"} />
            <Detail label="Fleet" value={load.fleet_company ?? "Not set"} />
            <Detail label="Truck" value={load.truck_number ?? "Not set"} />
            <Detail label="Trailer" value={load.trailer_number ?? "Not set"} />
            <Detail label="Round Trip" value={load.is_round_trip ? "Yes" : "No"} />
            <Detail label="Commodity" value={load.commodity ?? "Not set"} />
            <Detail label="Weight" value={load.weight_lbs === null ? "Not set" : `${Number(load.weight_lbs).toLocaleString()} lb`} />
            <Detail label="Pallets" value={load.pallet_count === null ? "Not set" : load.pallet_count} />
            <Detail label="Created" value={new Date(load.created_at).toLocaleString()} />
          </dl>
          {load.special_instructions ? <div className="mt-5 border-t border-zinc-100 pt-4"><h3 className="text-sm font-semibold text-zinc-950">Special Instructions</h3><p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{load.special_instructions}</p></div> : null}
          {load.notes ? (
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <h3 className="text-sm font-semibold text-zinc-950">Load Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{load.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Invoice</h2>
            <dl className="space-y-3">
              <Detail label="Status" value={payment?.invoice_status ?? (payment?.invoice_sent ? "Sent" : "Draft")} />
              <Detail label="Invoice number" value={payment?.invoice_number ?? "Not set"} />
              <Detail label="Invoice date" value={formatDate(payment?.invoice_date ?? payment?.invoice_sent_date)} />
              <Detail label="Due date" value={formatDate(payment?.due_date)} />
            </dl>
            <LinkButton href={`/collections/${id}`} variant="secondary" className="mt-4">Manage collections</LinkButton>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Financial Summary</h2>
            {completeness.complete ? (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">Financial inputs complete</div>
            ) : (
              <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="font-semibold">Financial inputs incomplete</div>
                <div className="mt-1">Missing {completeness.missingLabels.join(", ")}. The margin below is provisional and must not be treated as final profit.</div>
              </div>
            )}
            <dl className="space-y-3">
              <Detail label="Load Rate" value={currency(load.load_rate)} />
              <Detail label="Driver Pay" value={load.driver_pay_known ? currency(load.driver_pay) : "Unknown"} />
              <Detail label="Dispatcher Fee" value={load.dispatcher_fee_known ? currency(load.dispatcher_fee) : "Unknown"} />
              <Detail label="Load fuel estimate" value={load.fuel_cost_known ? currency(load.fuel_cost) : "Unknown"} />
              <Detail
                label={
                  load.factoring_mode === "amount"
                    ? "Factoring (fixed amount)"
                    : `Factoring (${Number(load.factoring_percent).toFixed(2)}%)`
                }
                value={currency(load.factoring_amount)}
              />
              {load.load_deductions.map((deduction) => (
                <Detail key={deduction.id} label={`Other: ${deduction.label}`} value={currency(deduction.amount)} />
              ))}
              <Detail label="Total Deductions" value={currency(totalDeductions)} />
              <Detail label={completeness.complete ? "Estimated Profit" : "Provisional Margin"} value={<span className={profit >= 0 ? "text-green-700" : "text-red-700"}>{currency(profit)}{completeness.complete ? "" : " · incomplete"}</span>} />
              <Detail label="Client Collected" value={currency(collected)} />
              <Detail label="Client Outstanding" value={currency(outstanding)} />
              <Detail label="Client reconciliation" value={<Link className="font-semibold text-[#6757e8] underline" href={`/collections/${id}`}>{currency(outstanding)} outstanding · view ledger</Link>} />
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
                  <ActionForm action={deleteDocument.bind(null, document.id)} successMessage={false}>
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

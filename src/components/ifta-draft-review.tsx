"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { reviewIftaDraft } from "@/lib/actions/ifta";
import type { IftaDraft } from "@/lib/data/ifta";
import {
  formatQuantity,
  iftaJurisdictions,
  type IftaFuelDraftPayload,
  type IftaTripDraftPayload,
} from "@/lib/ifta";
import { currency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type TruckOption = { id: string; unit_number: string; company: string | null };
type MilesRow = { key: number; state: string; miles: string };

function statusClasses(status: string) {
  if (status === "approved") return "border-green-200 bg-green-50 text-green-800";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

function SourceLink({ draft }: { draft: IftaDraft }) {
  if (draft.loads) {
    return <Link href={`/loads/${draft.loads.id}`} className="font-semibold text-[#5143c2] hover:underline">Load {draft.loads.load_number}</Link>;
  }
  if (draft.bookkeeping_expense_groups) {
    return (
      <Link href={`/bookkeeping?from=${draft.report_date}&to=${draft.report_date}`} className="font-semibold text-[#5143c2] hover:underline">
        Bookkeeping source · {draft.bookkeeping_expense_groups.bookkeeping_receipts.length} receipt{draft.bookkeeping_expense_groups.bookkeeping_receipts.length === 1 ? "" : "s"}
      </Link>
    );
  }
  return <span>Source unavailable</span>;
}

function ApprovedSummary({ draft }: { draft: IftaDraft }) {
  if (draft.draft_type === "trip") {
    const payload = draft.payload as IftaTripDraftPayload;
    return (
      <p className="text-sm text-zinc-600">
        {payload.truck_number} · {payload.pickup_city} → {payload.dropoff_city} · {formatQuantity(payload.state_miles.reduce((total, leg) => total + Number(leg.miles), 0))} mi
      </p>
    );
  }
  const payload = draft.payload as IftaFuelDraftPayload;
  return <p className="text-sm text-zinc-600">{payload.truck_number} · {formatQuantity(Number(payload.gallons))} gal · {currency(payload.amount_paid)}</p>;
}

export function IftaDraftReview({ draft, trucks }: { draft: IftaDraft; trucks: TruckOption[] }) {
  const trip = draft.draft_type === "trip" ? draft.payload as IftaTripDraftPayload : null;
  const fuel = draft.draft_type === "fuel" ? draft.payload as IftaFuelDraftPayload : null;
  const nextKey = useRef(10);
  const [milesRows, setMilesRows] = useState<MilesRow[]>(
    trip?.state_miles.length
      ? trip.state_miles.map((leg, index) => ({ key: index, state: leg.state, miles: String(leg.miles) }))
      : [{ key: 0, state: "", miles: "" }],
  );
  const editable = draft.status !== "approved";

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", statusClasses(draft.status))}>{draft.status}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{draft.draft_type} draft</span>
          </div>
          <div className="mt-2 text-sm text-zinc-600"><SourceLink draft={draft} /> · {formatDate(draft.report_date)}</div>
        </div>
        {draft.missing_fields.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Missing: {draft.missing_fields.join(", ")}
          </div>
        ) : null}
      </div>

      {!editable ? <div className="mt-4"><ApprovedSummary draft={draft} /></div> : (
        <ActionForm action={reviewIftaDraft.bind(null, draft.id, draft.draft_type as "trip" | "fuel")} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fleet truck">
            <Select name="unit_id" defaultValue={String(draft.payload.unit_id ?? "")}>
              <option value="">Select truck</option>
              {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.company ?? "Unassigned"} · {truck.unit_number}</option>)}
            </Select>
          </Field>

          {trip ? (
            <>
              <Field label="Trip start"><Input type="date" name="start_date" required defaultValue={trip.start_date} /></Field>
              <Field label="Trip end"><Input type="date" name="end_date" defaultValue={trip.end_date ?? ""} /></Field>
              <div className="hidden lg:block" />
              <Field label="Pickup"><Input name="pickup_city" required defaultValue={trip.pickup_city} /></Field>
              <Field label="Delivery"><Input name="dropoff_city" required defaultValue={trip.dropoff_city} /></Field>
              {trip.suggested_states?.length && !trip.state_miles.length ? (
                <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 sm:col-span-2">
                  Stop addresses suggest {trip.suggested_states.join(", ")}. Enter actual miles driven in each jurisdiction before approval.
                </p>
              ) : null}
              <fieldset className="sm:col-span-2 lg:col-span-4">
                <legend className="text-sm font-semibold text-zinc-700">Actual miles by state</legend>
                <div className="mt-2 grid gap-2">
                  {milesRows.map((row) => (
                    <div key={row.key} className="flex flex-wrap gap-2">
                      <Select name="draft_state_code" value={row.state} onChange={(event) => setMilesRows((current) => current.map((item) => item.key === row.key ? { ...item, state: event.target.value } : item))} className="mt-0 w-full sm:w-56">
                        <option value="">Select state</option>
                        {iftaJurisdictions.map((state) => <option key={state.code} value={state.code}>{state.code} — {state.name}</option>)}
                      </Select>
                      <Input type="number" name="draft_state_miles" min="0.1" step="0.1" value={row.miles} onChange={(event) => setMilesRows((current) => current.map((item) => item.key === row.key ? { ...item, miles: event.target.value } : item))} placeholder="Miles" className="mt-0 w-full sm:w-36" />
                      {milesRows.length > 1 ? <button type="button" onClick={() => setMilesRows((current) => current.filter((item) => item.key !== row.key))} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">Remove</button> : null}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setMilesRows((current) => [...current, { key: nextKey.current++, state: "", miles: "" }])} className="mt-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">+ Add state</button>
              </fieldset>
            </>
          ) : null}

          {fuel ? (
            <>
              <Field label="Purchase date"><Input type="date" name="purchase_date" required defaultValue={fuel.purchase_date} /></Field>
              <Field label="Vendor"><Input name="vendor" defaultValue={fuel.vendor ?? ""} /></Field>
              <Field label="City"><Input name="city" defaultValue={fuel.city ?? ""} /></Field>
              <Field label="State">
                <Select name="state" defaultValue={fuel.state ?? ""}><option value="">Select state</option>{iftaJurisdictions.map((state) => <option key={state.code} value={state.code}>{state.code} — {state.name}</option>)}</Select>
              </Field>
              <Field label="Gallons"><Input type="number" name="gallons" min="0.1" step="0.1" defaultValue={fuel.gallons ?? ""} /></Field>
              <Field label="Amount paid"><Input type="number" name="amount_paid" min="0.01" step="0.01" required defaultValue={fuel.amount_paid} /></Field>
            </>
          ) : null}

          <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={(trip ?? fuel)?.notes ?? ""} /></Field>
          <Field label="Review note" className="sm:col-span-2"><Textarea name="review_note" defaultValue={draft.review_note ?? ""} placeholder="Why this was changed, rejected, or excluded" /></Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <SubmitButton name="review_action" value="save" variant="secondary" pendingText="Saving...">Save draft</SubmitButton>
            <SubmitButton name="review_action" value="approve" pendingText="Approving...">Approve &amp; post</SubmitButton>
            <SubmitButton name="review_action" value="reject" variant="secondary" pendingText="Updating...">Reject</SubmitButton>
            <SubmitButton name="review_action" value="exclude" variant="secondary" pendingText="Updating...">Exclude source</SubmitButton>
          </div>
        </ActionForm>
      )}
    </article>
  );
}

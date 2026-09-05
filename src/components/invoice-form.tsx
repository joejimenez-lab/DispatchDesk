import { ActionForm } from "@/components/action-form";
import { LinkButton } from "@/components/button";
import { Field, Input, Select } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { invoiceStatuses, type InvoiceStatus } from "@/lib/invoices";
import { currency } from "@/lib/utils";
import type { InvoiceLoadOption, InvoiceRecord } from "@/lib/data/invoices";
import type { ActionState } from "@/lib/actions/state";

type InvoiceAction = (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;

export function InvoiceForm({
  action,
  loads,
  invoice,
  selectedLoadId,
}: {
  action: InvoiceAction;
  loads?: InvoiceLoadOption[];
  invoice?: InvoiceRecord;
  selectedLoadId?: string;
}) {
  const selected = invoice?.loads ?? loads?.find((load) => load.id === selectedLoadId);
  const loadLocked = Boolean(invoice || selectedLoadId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={action} className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5">
      {loadLocked && selected ? (
        <div>
          <input type="hidden" name="load_id" value={selected.id} />
          <div className="text-xs font-semibold uppercase text-zinc-500">Load</div>
          <div className="mt-1 font-semibold text-zinc-950">{selected.load_number}</div>
          <div className="text-sm text-zinc-600">
            {selected.brokers?.company_name ?? "No broker"} · {selected.pickup_location} to {selected.delivery_location} · {currency(selected.load_rate)}
          </div>
        </div>
      ) : (
        <Field label="Load">
          <Select name="load_id" required defaultValue="">
            <option value="" disabled>Choose a load</option>
            {(loads ?? []).map((load) => (
              <option key={load.id} value={load.id}>
                {load.load_number} · {load.brokers?.company_name ?? "No broker"} · {currency(load.load_rate)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Status">
          <Select name="invoice_status" defaultValue={(invoice?.invoice_status as InvoiceStatus | null) ?? "Draft"}>
            {invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </Field>
        <Field label="Invoice number">
          <Input name="invoice_number" defaultValue={invoice?.invoice_number ?? ""} placeholder="Required when sent" />
        </Field>
        <Field label="Invoice date">
          <Input name="invoice_date" type="date" defaultValue={invoice?.invoice_date ?? today} />
        </Field>
        <Field label="Payment terms (days)">
          <Input name="payment_terms_days" type="number" min="0" max="365" defaultValue={invoice?.payment_terms_days ?? 30} />
        </Field>
        <Field label="Due date">
          <Input name="due_date" type="date" defaultValue={invoice?.due_date ?? ""} />
        </Field>
      </div>

      <p className="text-sm text-zinc-500">Invoice number and date are required when the status is Sent. Leave due date blank to calculate it from the payment terms.</p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Saving invoice...">{invoice ? "Save invoice" : "Create invoice"}</SubmitButton>
        <LinkButton href={invoice ? `/loads/${invoice.load_id}` : "/invoices"} variant="secondary">Cancel</LinkButton>
      </div>
    </ActionForm>
  );
}

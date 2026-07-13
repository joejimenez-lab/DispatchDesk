import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import type { ActionState } from "@/lib/actions/state";
import { receiptAccept } from "@/lib/bookkeeping";
import type { IftaFuelPurchase } from "@/lib/data/ifta";
import { iftaJurisdictions } from "@/lib/ifta";

type TruckOption = { id: string; unit_number: string; company: string | null };

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;
  trucks: TruckOption[];
  purchase?: IftaFuelPurchase;
};

export function IftaFuelForm({ action, trucks, purchase }: Props) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {!purchase ? <input type="hidden" name="operation_id" value={crypto.randomUUID()} /> : null}
      <Field label="Fleet truck">
        <Select name="unit_id" required defaultValue={purchase?.unit_id ?? ""}>
          <option value="" disabled>Choose truck</option>
          {trucks.map((truck) => (
            <option key={truck.id} value={truck.id}>{truck.company ? `${truck.company} - ` : ""}Truck {truck.unit_number}</option>
          ))}
        </Select>
      </Field>
      <Field label="Purchase date"><Input type="date" name="purchase_date" required defaultValue={purchase?.purchase_date ?? ""} /></Field>
      <Field label="Vendor / truck stop"><Input name="vendor" defaultValue={purchase?.vendor ?? ""} placeholder="e.g. Love's" /></Field>
      <Field label="City"><Input name="city" defaultValue={purchase?.city ?? ""} placeholder="e.g. Mesquite" /></Field>
      <Field label="State">
        <Select name="state" required defaultValue={purchase?.state ?? ""}>
          <option value="" disabled>Select state</option>
          {iftaJurisdictions.map((jurisdiction) => <option key={jurisdiction.code} value={jurisdiction.code}>{jurisdiction.code} — {jurisdiction.name}</option>)}
        </Select>
      </Field>
      <Field label="Gallons"><Input type="number" name="gallons" required min="0.1" step="0.1" defaultValue={purchase?.gallons ?? ""} /></Field>
      <Field label="Amount paid ($)"><Input type="number" name="amount_paid" required min="0.01" step="0.01" defaultValue={purchase?.amount_paid ?? ""} /></Field>
      {!purchase ? (
        <Field label="Receipt" className="sm:col-span-2">
          <input name="file" type="file" accept={receiptAccept} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
        </Field>
      ) : null}
      <Field label="Notes" className="sm:col-span-2 lg:col-span-3"><Textarea name="notes" defaultValue={purchase?.notes ?? ""} /></Field>
      <SubmitButton className="sm:w-fit" pendingText="Saving...">{purchase ? "Save fuel purchase" : "Add fuel purchase"}</SubmitButton>
    </ActionForm>
  );
}

import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import type { ActionState } from "@/lib/actions/state";
import { iftaJurisdictions } from "@/lib/ifta";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;
  truckNumbers: string[];
};

export function IftaFuelForm({ action, truckNumbers }: Props) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Truck #">
        <Input name="truck_number" required list="ifta-fuel-trucks" placeholder="e.g. 521" />
      </Field>
      <datalist id="ifta-fuel-trucks">
        {truckNumbers.map((truck) => <option key={truck} value={truck} />)}
      </datalist>

      <Field label="Purchase date">
        <Input type="date" name="purchase_date" required />
      </Field>
      <Field label="City">
        <Input name="city" placeholder="e.g. Mesquite" />
      </Field>

      <Field label="State">
        <Select name="state" required defaultValue="">
          <option value="" disabled>Select state</option>
          {iftaJurisdictions.map((jurisdiction) => (
            <option key={jurisdiction.code} value={jurisdiction.code}>
              {jurisdiction.code} — {jurisdiction.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Gallons">
        <Input type="number" name="gallons" required min="0.1" step="0.1" placeholder="e.g. 122.9" />
      </Field>
      <Field label="Amount paid ($)">
        <Input type="number" name="amount_paid" min="0" step="0.01" placeholder="e.g. 479.01" />
      </Field>

      <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
        <Textarea name="notes" placeholder="Truck stop, receipt number, or card used" />
      </Field>

      <SubmitButton className="sm:w-fit" pendingText="Saving...">Add fuel purchase</SubmitButton>
    </ActionForm>
  );
}

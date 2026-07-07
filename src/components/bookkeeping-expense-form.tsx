import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { encodeMaintenanceRecord, receiptAccept } from "@/lib/bookkeeping";
import type { ActionState } from "@/lib/actions/state";
import type { BookkeepingExpense, BookkeepingOptions } from "@/lib/data/bookkeeping";
import { expenseCategories } from "@/types/database";

type ExpenseFormAction = (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function maintenanceRecordValue(expense: BookkeepingExpense | undefined) {
  if (expense?.service_record_id) {
    return encodeMaintenanceRecord({ table: "service_records", id: expense.service_record_id });
  }
  if (expense?.inspection_record_id) {
    return encodeMaintenanceRecord({ table: "inspection_records", id: expense.inspection_record_id });
  }
  if (expense?.repair_log_id) {
    return encodeMaintenanceRecord({ table: "repair_logs", id: expense.repair_log_id });
  }
  return "";
}

export function BookkeepingExpenseForm({
  action,
  options,
  expense,
  submitLabel,
  pendingText = "Saving...",
  includeReceipt = false,
}: {
  action: ExpenseFormAction;
  options: BookkeepingOptions;
  expense?: BookkeepingExpense;
  submitLabel: string;
  pendingText?: string;
  includeReceipt?: boolean;
}) {
  return (
    <ActionForm action={action} className="grid gap-3 md:grid-cols-4">
      <Field label="Date">
        <Input type="date" name="expense_date" required defaultValue={expense?.expense_date ?? today()} />
      </Field>
      <Field label="Category">
        <Select name="category" required defaultValue={expense?.category ?? "Fuel"}>
          {expenseCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount">
        <Input type="number" min="0.01" step="0.01" name="amount" required defaultValue={expense?.amount ?? ""} />
      </Field>
      <Field label="Vendor">
        <Input name="vendor" defaultValue={expense?.vendor ?? ""} />
      </Field>

      <Field label="Truck / Trailer">
        <Select name="unit_id" defaultValue={expense?.unit_id ?? ""}>
          <option value="">None</option>
          {options.units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unit_type} {unit.unit_number}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Load">
        <Select name="load_id" defaultValue={expense?.load_id ?? ""}>
          <option value="">None</option>
          {options.loads.map((load) => (
            <option key={load.id} value={load.id}>
              {load.load_number} - {load.pickup_location} to {load.delivery_location}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Driver">
        <Select name="driver_id" defaultValue={expense?.driver_id ?? ""}>
          <option value="">None</option>
          {options.drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Maintenance record">
        <Select name="maintenance_record" defaultValue={maintenanceRecordValue(expense)}>
          <option value="">None</option>
          {options.maintenanceRecords.map((record) => (
            <option key={record.value} value={record.value}>
              {record.label}
            </option>
          ))}
        </Select>
      </Field>

      {includeReceipt ? (
        <Field label="Receipt" className="md:col-span-2">
          <input
            name="file"
            type="file"
            accept={receiptAccept}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </Field>
      ) : null}
      <Field label="Notes" className={includeReceipt ? "md:col-span-2" : "md:col-span-4"}>
        <Textarea name="notes" defaultValue={expense?.notes ?? ""} />
      </Field>
      <SubmitButton className="md:w-fit" pendingText={pendingText}>
        {submitLabel}
      </SubmitButton>
    </ActionForm>
  );
}

import { ActionForm } from "@/components/action-form";
import { BookkeepingAmountFields } from "@/components/bookkeeping-amount-fields";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import { encodeMaintenanceRecord, receiptAccept } from "@/lib/bookkeeping";
import type { ActionState } from "@/lib/actions/state";
import type { BookkeepingExpense, BookkeepingOptions } from "@/lib/data/bookkeeping";

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

function unitOptionLabel(unit: BookkeepingOptions["units"][number]) {
  return unit.company
    ? `${unit.company} - ${unit.unit_type} ${unit.unit_number}`
    : `${unit.unit_type} ${unit.unit_number}`;
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
  const sourceType = (expense?.source_type ?? "manual") as "manual" | "maintenance" | "ifta";
  return (
    <ActionForm action={action} className="grid gap-3 md:grid-cols-4">
      {!expense ? <input type="hidden" name="operation_id" value={crypto.randomUUID()} /> : null}
      <Field label="Date">
        <Input type="date" name="expense_date" required defaultValue={expense?.expense_date ?? today()} />
      </Field>
      <BookkeepingAmountFields
        sourceType={sourceType}
        category={expense?.category ?? "Fuel"}
        amount={expense?.amount ?? ""}
        lines={expense?.bookkeeping_expenses}
      />
      <Field label="Vendor">
        <Input name="vendor" defaultValue={expense?.vendor ?? ""} />
      </Field>

      <Field label="Fleet / Truck / Trailer">
        <Select name="unit_id" defaultValue={expense?.unit_id ?? ""}>
          <option value="">None</option>
          {options.units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unitOptionLabel(unit)}
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
      {sourceType === "manual" ? <Field label="Maintenance record">
        <Select name="maintenance_record" defaultValue={maintenanceRecordValue(expense)}>
          <option value="">None</option>
          {options.maintenanceRecords.map((record) => (
            <option key={record.value} value={record.value}>
              {record.label}
            </option>
          ))}
        </Select>
      </Field> : <input type="hidden" name="maintenance_record" value={maintenanceRecordValue(expense)} />}

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

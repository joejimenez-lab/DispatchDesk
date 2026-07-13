"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/field";
import { SubmitButton } from "@/components/form-buttons";
import type { ActionState } from "@/lib/actions/state";
import { defaultIntervalDays, defaultIntervalMiles, maintenanceTypesForUnit, type MaintenanceReminderRow } from "@/lib/maintenance";
import type { Database, MaintenanceReminderType, UnitType } from "@/types/database";

type Unit = Pick<
  Database["public"]["Tables"]["fleet_units"]["Row"],
  "id" | "unit_number" | "unit_type"
>;

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState> | ActionState;
  submitLabel: string;
  units?: Unit[];
  unitId?: string;
  unitType?: UnitType;
  reminder?: MaintenanceReminderRow;
};

export function MaintenanceReminderForm({
  action,
  submitLabel,
  units = [],
  unitId,
  unitType,
  reminder,
}: Props) {
  const initialUnit = unitId ? null : units[0] ?? null;
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType | null>(unitType ?? initialUnit?.unit_type ?? null);
  const allowedTypes = maintenanceTypesForUnit(selectedUnitType);
  const [type, setType] = useState<MaintenanceReminderType>((reminder?.reminder_type as MaintenanceReminderType | undefined) ?? allowedTypes[0]);

  function changeUnit(nextUnitId: string) {
    const nextUnitType = units.find((unit) => unit.id === nextUnitId)?.unit_type ?? null;
    setSelectedUnitType(nextUnitType);
    const nextTypes = maintenanceTypesForUnit(nextUnitType);
    if (!nextTypes.includes(type)) setType(nextTypes[0]);
  }

  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {!unitId ? (
        <Field label="Fleet unit">
          <Select name="unit_id" required onChange={(event) => changeUnit(event.target.value)}>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_number} · {unit.unit_type}</option>)}
          </Select>
        </Field>
      ) : <input type="hidden" name="unit_id" value={unitId} />}

      <Field label="Maintenance type">
        <Select name="reminder_type" value={type} onChange={(event) => setType(event.target.value as MaintenanceReminderType)}>
          {allowedTypes.map((option) => <option key={option}>{option}</option>)}
        </Select>
      </Field>

      <Field label="Due date">
        <Input type="date" name="due_date" defaultValue={reminder?.due_date ?? ""} />
      </Field>
      <Field label="Due odometer">
        <Input type="number" min="0" name="due_odometer" defaultValue={reminder?.due_odometer ?? ""} placeholder="e.g. 125000" />
      </Field>

      <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 sm:col-span-2 lg:col-span-4">
        Leave the due date blank to calculate it from the repeat days. Leave the due odometer blank to calculate it from the unit&apos;s current mileage. If both are used, the alert is due when either limit is reached first.
      </p>

      <Field label="Repeat every (days)">
        <Input
          key={`${type}-days`}
          type="number"
          min="1"
          name="interval_days"
          defaultValue={reminder?.interval_days ?? defaultIntervalDays(type) ?? ""}
          placeholder="30 / 90 / 365"
        />
      </Field>
      <Field label="Repeat every (miles)">
        <Input
          key={`${type}-miles`}
          type="number"
          min="1"
          name="interval_miles"
          defaultValue={reminder?.interval_miles ?? defaultIntervalMiles(type) ?? ""}
          placeholder="5000"
        />
      </Field>
      <Field label="Warn before (days)">
        <Input type="number" min="0" name="warning_days" defaultValue={reminder?.warning_days ?? 30} />
      </Field>
      <Field label="Warn before (miles)">
        <Input type="number" min="0" name="warning_miles" defaultValue={reminder?.warning_miles ?? 500} />
      </Field>

      <Field label="Notes" className="sm:col-span-2 lg:col-span-4">
        <Textarea name="notes" defaultValue={reminder?.notes ?? ""} placeholder="Parts, vendor, service requirements, or follow-up details" />
      </Field>

      <SubmitButton className="sm:w-fit" pendingText="Saving...">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

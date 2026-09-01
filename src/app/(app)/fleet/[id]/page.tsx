import type { ReactNode } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CompanyFleetField } from "@/components/company-fleet-field";
import { MaintenanceReminderCard } from "@/components/maintenance-reminder-card";
import { MaintenanceReminderForm } from "@/components/maintenance-reminder-form";
import { MaintenanceSpendingEditor } from "@/components/maintenance-spending-editor";
import { Field, Input, Select, Textarea } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import {
  addInspectionRecord,
  addRepairLog,
  addServiceRecord,
  deleteFleetRecord,
  deleteUnit,
  updateUnit,
} from "@/lib/actions/fleet";
import { addMaintenanceReminder } from "@/lib/actions/maintenance";
import { getFleetCompanies, getUnit, getUnitRecords } from "@/lib/data/fleet";
import { classifyMaintenanceReminder, type MaintenanceAlert } from "@/lib/maintenance";
import { currency, formatDate } from "@/lib/utils";
import { repairLogTypes, unitTypes } from "@/types/database";

function odometer(value: number | null) {
  return value != null ? `${value.toLocaleString()} mi` : null;
}

function AddRecord({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group mb-4">
      <summary className="ml-auto flex w-fit cursor-pointer list-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">
        <span className="group-open:hidden">+ {label}</span>
        <span className="hidden group-open:inline">Cancel</span>
      </summary>
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">{children}</div>
    </details>
  );
}

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const isEditing = edit === "1";
  const [unit, records, companies] = await Promise.all([getUnit(id), getUnitRecords(id), getFleetCompanies()]);
  const reminderUnit = { id: unit.id, unit_number: unit.unit_number, unit_type: unit.unit_type, odometer: unit.odometer };
  const activeReminders = records.reminders
    .filter((reminder) => !reminder.completed_at)
    .map((reminder) => ({
      ...reminder,
      unit: reminderUnit,
      ...classifyMaintenanceReminder(reminder, unit.odometer),
    } satisfies MaintenanceAlert));
  const completedReminders = records.reminders.filter((reminder) => reminder.completed_at);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/fleet"
          className="mb-4 inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-base font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-950"
        >
          ← Back to fleet
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-zinc-950">{unit.unit_number}</h1>
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-300">
                {unit.unit_type}
              </span>
            </div>
            <p className="text-sm text-zinc-600">{unit.company ?? "No company set"}</p>
          </div>
          <Link
            href={isEditing ? `/fleet/${id}` : `/fleet/${id}?edit=1`}
            className={isEditing
              ? "inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              : "inline-flex rounded-[10px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"}
          >
            {isEditing ? "Cancel" : "Edit unit"}
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {isEditing ? (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Edit unit</h2>
            <ActionForm action={updateUnit.bind(null, id)} className="grid gap-4 md:grid-cols-3">
              <CompanyFleetField companies={companies} defaultValue={unit.company ?? ""} />
              <Field label="Unit Number"><Input name="unit_number" required defaultValue={unit.unit_number} /></Field>
              <Field label="Unit Type">
                <Select name="unit_type" defaultValue={unit.unit_type}>
                  {unitTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </Field>
              <Field label="Odometer"><Input type="number" min="0" name="odometer" defaultValue={unit.odometer ?? ""} /></Field>
              <Field label="Notes" className="md:col-span-3"><Textarea name="notes" defaultValue={unit.notes ?? ""} /></Field>
              <SubmitButton variant="secondary" className="md:w-fit">Save changes</SubmitButton>
            </ActionForm>
            <div className="mt-6 border-t border-zinc-200 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-zinc-950">Delete this unit</h3>
                <p className="text-sm text-zinc-600">
                  {records.financialLinkCount
                    ? `${records.financialLinkCount} Bookkeeping transaction${records.financialLinkCount === 1 ? " refers" : "s refer"} to this unit. Reassign those transactions before deleting it.`
                    : "This permanently removes the unit and its non-financial maintenance records."}
                </p>
              </div>
              {!records.financialLinkCount ? <ActionForm action={deleteUnit.bind(null, id)} successMessage={false}>
                <ConfirmSubmitButton
                  message={`Delete ${unit.unit_type.toLowerCase()} ${unit.unit_number} and its non-financial service, inspection, and repair history?`}
                  variant="danger"
                >
                  Delete unit
                </ConfirmSubmitButton>
              </ActionForm> : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Fleet company</div>
              <div className="mt-1 text-sm font-medium text-zinc-950">{unit.company ?? "Not set"}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Odometer</div>
              <div className="mt-1 text-sm font-medium text-zinc-950">{odometer(unit.odometer) ?? "Not set"}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{unit.notes ?? "No notes"}</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Maintenance schedules</h2>
            <p className="text-sm text-zinc-600">Automatic date and mileage reminders for this unit.</p>
          </div>
          <Link href={`/maintenance?unit=${id}`} className="text-sm font-medium text-zinc-950 underline">View in Maintenance</Link>
        </div>
        <AddRecord label="Add schedule">
          <MaintenanceReminderForm action={addMaintenanceReminder} unitId={id} unitType={unit.unit_type} submitLabel="Add schedule" />
        </AddRecord>
        <div className="grid gap-4 border-t border-zinc-100 pt-4">
          {activeReminders.map((reminder) => <MaintenanceReminderCard key={reminder.id} alert={reminder} />)}
          {!activeReminders.length ? <p className="py-4 text-sm text-zinc-500">No active maintenance schedules.</p> : null}
        </div>
      </section>

      {completedReminders.length ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Completed schedule activity</h2>
          <div className="mt-3 divide-y divide-zinc-100">
            {completedReminders.map((reminder) => (
              <div key={reminder.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium text-zinc-900">{reminder.reminder_type}</div>
                  <div className="text-xs text-zinc-500">Completed {reminder.completed_at ? new Date(reminder.completed_at).toLocaleString() : ""}</div>
                </div>
                <div className="text-right text-xs text-zinc-500">by {reminder.completed_by_email ?? "authenticated user"}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="pt-1">
        <h2 className="text-xl font-semibold text-zinc-950">Maintenance history</h2>
        <p className="text-sm text-zinc-600">Service, inspections, and repairs for this unit.</p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">
            Service <span className="text-sm font-normal text-zinc-500">({records.service.length})</span>
          </h2>
        </div>
        <AddRecord label="Add service">
            <ActionForm action={addServiceRecord} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="unit_id" value={id} />
              <Field label="Date"><Input type="date" name="service_date" /></Field>
              <Field label="Odometer"><Input type="number" min="0" name="odometer" /></Field>
              <Field label="Cost"><Input type="number" min="0" step="0.01" name="cost" /></Field>
              <Field label="Description" className="md:col-span-4"><Input name="description" required /></Field>
              <Field label="Notes" className="md:col-span-4"><Textarea name="notes" /></Field>
              <SubmitButton className="md:w-fit" pendingText="Adding...">Add service</SubmitButton>
            </ActionForm>
        </AddRecord>
        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {records.service.map((record) => (
            <div key={record.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <div className="font-medium text-zinc-950">{record.description}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {formatDate(record.service_date)}
                  {odometer(record.odometer) ? ` · ${odometer(record.odometer)}` : ""}
                  {` · ${currency(record.cost)}`}
                </div>
                {record.notes ? <p className="mt-1 text-sm text-zinc-600">{record.notes}</p> : null}
                <MaintenanceSpendingEditor table="service_records" recordId={record.id} unitId={id} date={record.service_date} odometer={record.odometer} notes={record.notes} cost={Number(record.cost)} expense={record.bookkeeping_expense_groups[0]} />
              </div>
              {!record.bookkeeping_expense_groups.length ? <ActionForm action={deleteFleetRecord.bind(null, "service_records", record.id, id)} successMessage={false}>
                <ConfirmSubmitButton message="Delete this service record?" variant="secondary">Delete</ConfirmSubmitButton>
              </ActionForm> : null}
            </div>
          ))}
          {!records.service.length ? <p className="py-4 text-sm text-zinc-500">No service records yet.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">
            Inspections <span className="text-sm font-normal text-zinc-500">({records.inspections.length})</span>
          </h2>
        </div>
        <AddRecord label="Add inspection">
            <ActionForm action={addInspectionRecord} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="unit_id" value={id} />
              <Field label="Date"><Input type="date" name="inspection_date" /></Field>
              <Field label="Odometer"><Input type="number" min="0" name="odometer" /></Field>
              <Field label="Inspector"><Input name="inspector" /></Field>
              <Field label="Result"><Input name="result" placeholder="Pass / Fail" required /></Field>
              <Field label="Cost"><Input type="number" min="0" step="0.01" name="cost" /></Field>
              <Field label="Notes" className="md:col-span-4"><Textarea name="notes" /></Field>
              <SubmitButton className="md:w-fit" pendingText="Adding...">Add inspection</SubmitButton>
            </ActionForm>
        </AddRecord>
        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {records.inspections.map((record) => (
            <div key={record.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <div className="font-medium text-zinc-950">{record.result ?? "Inspection"}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {formatDate(record.inspection_date)}
                  {record.inspector ? ` · ${record.inspector}` : ""}
                  {odometer(record.odometer) ? ` · ${odometer(record.odometer)}` : ""}
                  {` · ${currency(record.cost)}`}
                </div>
                {record.notes ? <p className="mt-1 text-sm text-zinc-600">{record.notes}</p> : null}
                <MaintenanceSpendingEditor table="inspection_records" recordId={record.id} unitId={id} date={record.inspection_date} odometer={record.odometer} notes={record.notes} cost={Number(record.cost)} expense={record.bookkeeping_expense_groups[0]} />
              </div>
              {!record.bookkeeping_expense_groups.length ? <ActionForm action={deleteFleetRecord.bind(null, "inspection_records", record.id, id)} successMessage={false}>
                <ConfirmSubmitButton message="Delete this inspection record?" variant="secondary">Delete</ConfirmSubmitButton>
              </ActionForm> : null}
            </div>
          ))}
          {!records.inspections.length ? <p className="py-4 text-sm text-zinc-500">No inspection records yet.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">
            Repairs & daily logs <span className="text-sm font-normal text-zinc-500">({records.repairs.length})</span>
          </h2>
        </div>
        <AddRecord label="Add repair / daily log">
            <ActionForm action={addRepairLog} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="unit_id" value={id} />
              <Field label="Entry type">
                <Select name="log_type" required defaultValue="Repair">
                  {repairLogTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </Field>
              <Field label="Date"><Input type="date" name="repair_date" /></Field>
              <Field label="Odometer"><Input type="number" min="0" name="odometer" /></Field>
              <Field label="Cost"><Input type="number" min="0" step="0.01" name="cost" /></Field>
              <Field label="Description" className="md:col-span-4"><Input name="description" required /></Field>
              <Field label="Notes" className="md:col-span-4"><Textarea name="notes" /></Field>
              <SubmitButton className="md:w-fit" pendingText="Adding...">Add repair</SubmitButton>
            </ActionForm>
        </AddRecord>
        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {records.repairs.map((record) => (
            <div key={record.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-medium text-zinc-950">
                  {record.description}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-600">{record.log_type}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {formatDate(record.repair_date)}
                  {odometer(record.odometer) ? ` · ${odometer(record.odometer)}` : ""}
                  {` · ${currency(record.cost)}`}
                </div>
                {record.notes ? <p className="mt-1 text-sm text-zinc-600">{record.notes}</p> : null}
                <MaintenanceSpendingEditor table="repair_logs" recordId={record.id} unitId={id} date={record.repair_date} odometer={record.odometer} notes={record.notes} cost={Number(record.cost)} expense={record.bookkeeping_expense_groups[0]} />
              </div>
              {!record.bookkeeping_expense_groups.length ? <ActionForm action={deleteFleetRecord.bind(null, "repair_logs", record.id, id)} successMessage={false}>
                <ConfirmSubmitButton message="Delete this repair log?" variant="secondary">Delete</ConfirmSubmitButton>
              </ActionForm> : null}
            </div>
          ))}
          {!records.repairs.length ? <p className="py-4 text-sm text-zinc-500">No repairs or daily logs yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

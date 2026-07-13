import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { DetailsCloseButton } from "@/components/details-close-button";
import { MaintenanceReminderForm } from "@/components/maintenance-reminder-form";
import { MaintenanceCostFields } from "@/components/maintenance-cost-fields";
import { Field, Input, Textarea } from "@/components/field";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import {
  clearMaintenanceSnooze,
  completeMaintenanceReminder,
  deleteMaintenanceReminder,
  snoozeMaintenanceReminder,
  updateMaintenanceReminder,
} from "@/lib/actions/maintenance";
import { addDays, localDateString, maintenanceRecurrenceLabel, maintenanceWillRepeat, type MaintenanceAlert } from "@/lib/maintenance";
import { formatDate } from "@/lib/utils";

const statusTone = {
  overdue: "border-red-200 bg-red-50 text-red-800",
  "due-soon": "border-amber-200 bg-amber-50 text-amber-800",
  upcoming: "border-blue-200 bg-blue-50 text-blue-800",
};

const statusLabel = { overdue: "Overdue", "due-soon": "Due soon", upcoming: "Upcoming" };

function targetLabel(alert: MaintenanceAlert) {
  const targets = [];
  if (alert.due_date) targets.push(`Date ${formatDate(alert.due_date)}`);
  if (alert.due_odometer != null) targets.push(`${alert.due_odometer.toLocaleString()} mi`);
  return targets.join(" · ");
}

function remainingLabel(alert: MaintenanceAlert) {
  const values = [];
  if (alert.daysRemaining != null) {
    values.push(alert.daysRemaining < 0
      ? `${Math.abs(alert.daysRemaining)} day${alert.daysRemaining === -1 ? "" : "s"} overdue`
      : alert.daysRemaining === 0 ? "Due today" : `${alert.daysRemaining} days remaining`);
  }
  if (alert.milesRemaining != null) {
    values.push(alert.milesRemaining < 0
      ? `${Math.abs(alert.milesRemaining).toLocaleString()} mi overdue`
      : `${alert.milesRemaining.toLocaleString()} mi remaining`);
  }
  return values.join(" · ");
}

export function MaintenanceReminderCard({ alert }: { alert: MaintenanceAlert }) {
  const unitId = alert.unit_id;

  return (
    <article id={`reminder-${alert.id}`} className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-zinc-950">{alert.reminder_type}</h2>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[alert.status]}`}>
              {statusLabel[alert.status]}
            </span>
            {alert.snoozed ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">Snoozed</span> : null}
          </div>
          <Link href={`/fleet/${unitId}`} className="mt-1 inline-block text-sm font-medium text-zinc-700 underline-offset-2 hover:underline">
            {alert.unit.unit_number} · {alert.unit.unit_type}
          </Link>
          <p className="mt-2 text-sm font-medium text-zinc-900">{targetLabel(alert)}</p>
          <p className="text-xs text-zinc-500">{remainingLabel(alert)}</p>
          {alert.snoozed_until ? <p className="mt-1 text-xs font-medium text-violet-700">Hidden from dashboard until {formatDate(alert.snoozed_until)}</p> : null}
          {alert.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600">{alert.notes}</p> : null}
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>Repeat: {maintenanceRecurrenceLabel(alert)}</div>
          <div className="mt-1">Created by {alert.created_by_email ?? "authenticated user"}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <details className="group">
          <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">Complete</summary>
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2 lg:absolute lg:left-1/2 lg:z-10 lg:w-[min(46rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:shadow-xl">
            <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
            <ActionForm action={completeMaintenanceReminder.bind(null, alert.id, unitId)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Completed date"><Input type="date" name="completed_date" required defaultValue={localDateString()} /></Field>
              <Field label="Current odometer"><Input type="number" min="0" name="odometer" defaultValue={alert.unit.odometer ?? ""} /></Field>
              <MaintenanceCostFields />
              <Field label="Completion notes" className="sm:col-span-2"><Textarea name="notes" /></Field>
              <SubmitButton className="sm:w-fit" pendingText="Completing...">
                {maintenanceWillRepeat(alert) ? "Complete and schedule next" : "Complete maintenance"}
              </SubmitButton>
            </ActionForm>
          </div>
        </details>

        <details>
          <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">Edit / reschedule</summary>
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2 lg:absolute lg:left-1/2 lg:z-10 lg:w-[min(60rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:shadow-xl">
            <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
            <MaintenanceReminderForm
              action={updateMaintenanceReminder.bind(null, alert.id, unitId)}
              unitId={unitId}
              unitType={alert.unit.unit_type}
              reminder={alert}
              submitLabel="Update schedule"
            />
          </div>
        </details>

        {alert.snoozed ? (
          <ActionForm action={clearMaintenanceSnooze.bind(null, alert.id, unitId)} successMessage={false}>
            <SubmitButton variant="secondary" className="w-full">End snooze</SubmitButton>
          </ActionForm>
        ) : (
          <details>
            <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">Snooze</summary>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-3 flex justify-end"><DetailsCloseButton /></div>
              <ActionForm action={snoozeMaintenanceReminder.bind(null, alert.id, unitId)} className="space-y-3">
                <Field label="Hide until"><Input type="date" name="snoozed_until" required defaultValue={addDays(localDateString(), 7)} /></Field>
                <SubmitButton variant="secondary" className="w-full">Snooze reminder</SubmitButton>
              </ActionForm>
            </div>
          </details>
        )}

        <ActionForm action={deleteMaintenanceReminder.bind(null, alert.id, unitId)} successMessage={false}>
          <ConfirmSubmitButton message="Delete this active maintenance schedule? Completed history will not be affected." variant="danger" className="w-full">Delete</ConfirmSubmitButton>
        </ActionForm>
      </div>
    </article>
  );
}

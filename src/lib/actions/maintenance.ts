"use server";

import { revalidatePath } from "next/cache";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { calculateInitialTargets, isMaintenanceTypeAllowedForUnit, localDateString } from "@/lib/maintenance";
import { logInfo } from "@/lib/logger";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import {
  maintenanceCompletionSchema,
  maintenanceReminderSchema,
  maintenanceSnoozeSchema,
} from "@/lib/validation/schemas";

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
}

function revalidateMaintenance(unitId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/maintenance");
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${unitId}`);
}

async function reminderPayload(formData: FormData) {
  const parsed = maintenanceReminderSchema.parse({
    unit_id: value(formData, "unit_id"),
    reminder_type: value(formData, "reminder_type"),
    due_date: value(formData, "due_date"),
    due_odometer: value(formData, "due_odometer"),
    interval_days: value(formData, "interval_days"),
    interval_miles: value(formData, "interval_miles"),
    warning_days: value(formData, "warning_days"),
    warning_miles: value(formData, "warning_miles"),
    notes: value(formData, "notes"),
  });

  const { supabase } = await createAuthenticatedClient();
  const { data: unit, error } = await supabase
    .from("fleet_units")
    .select("id, odometer, unit_type")
    .eq("id", parsed.unit_id)
    .single();
  if (error || !unit) throw new Error("Fleet unit not found.");
  if (!isMaintenanceTypeAllowedForUnit(parsed.reminder_type, unit.unit_type)) {
    throw new Error(`${parsed.reminder_type} is not available for ${unit.unit_type.toLowerCase()}s.`);
  }

  const targets = calculateInitialTargets({
    type: parsed.reminder_type,
    today: localDateString(),
    unitOdometer: unit.odometer,
    dueDate: parsed.due_date,
    dueOdometer: parsed.due_odometer,
    intervalDays: parsed.interval_days,
    intervalMiles: parsed.interval_miles,
  });

  if (!targets.dueDate && targets.dueOdometer == null) {
    throw new Error("Set a due date, due odometer, or repeat interval.");
  }

  return {
    ...parsed,
    due_date: targets.dueDate,
    due_odometer: targets.dueOdometer,
    interval_days: targets.intervalDays,
    interval_miles: targets.intervalMiles,
    warning_days: parsed.warning_days ?? 30,
    warning_miles: parsed.warning_miles ?? 500,
  };
}

export async function addMaintenanceReminder(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = await reminderPayload(formData);
    const { error } = await supabase.from("maintenance_reminders").insert({
      ...payload,
      created_by: user.id,
      created_by_email: user.email ?? null,
    });
    if (error) return errorState(error, "An active reminder of this type already exists for this unit.");
    logInfo("maintenance.schedule.created", { unitId: payload.unit_id, type: payload.reminder_type, userId: user.id });
    revalidateMaintenance(payload.unit_id);
    return successState("Maintenance schedule added.");
  } catch (error) {
    return errorState(error, "Could not add maintenance schedule.");
  }
}

export async function updateMaintenanceReminder(
  reminderId: string,
  unitId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = await reminderPayload(formData);
    if (payload.unit_id !== unitId) throw new Error("Invalid fleet unit.");

    const { data, error } = await supabase
      .from("maintenance_reminders")
      .update({
        reminder_type: payload.reminder_type,
        due_date: payload.due_date,
        due_odometer: payload.due_odometer,
        interval_days: payload.interval_days,
        interval_miles: payload.interval_miles,
        warning_days: payload.warning_days,
        warning_miles: payload.warning_miles,
        notes: payload.notes,
      })
      .eq("id", reminderId)
      .eq("unit_id", unitId)
      .is("completed_at", null)
      .select("id")
      .single();
    if (error || !data) return errorState(error, "Could not update this active schedule.");
    logInfo("maintenance.schedule.updated", { reminderId, unitId, userId: user.id });
    revalidateMaintenance(unitId);
    return successState("Maintenance schedule updated.");
  } catch (error) {
    return errorState(error, "Could not update maintenance schedule.");
  }
}

export async function snoozeMaintenanceReminder(
  reminderId: string,
  unitId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = maintenanceSnoozeSchema.parse({ snoozed_until: value(formData, "snoozed_until") });
    if (payload.snoozed_until <= localDateString()) throw new Error("Choose a future snooze date.");
    const { data, error } = await supabase
      .from("maintenance_reminders")
      .update({ snoozed_until: payload.snoozed_until })
      .eq("id", reminderId)
      .eq("unit_id", unitId)
      .is("completed_at", null)
      .select("id")
      .single();
    if (error || !data) return errorState(error, "Could not snooze this active reminder.");
    logInfo("maintenance.schedule.snoozed", { reminderId, unitId, until: payload.snoozed_until, userId: user.id });
    revalidateMaintenance(unitId);
    return successState(`Reminder snoozed until ${payload.snoozed_until}.`);
  } catch (error) {
    return errorState(error, "Could not snooze maintenance reminder.");
  }
}

export async function clearMaintenanceSnooze(
  reminderId: string,
  unitId: string,
  _state: ActionState,
): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from("maintenance_reminders")
      .update({ snoozed_until: null })
      .eq("id", reminderId)
      .eq("unit_id", unitId)
      .is("completed_at", null)
      .select("id")
      .single();
    if (error || !data) return errorState(error, "Active maintenance reminder not found.");
    logInfo("maintenance.schedule.snooze_cleared", { reminderId, unitId, userId: user.id });
    revalidateMaintenance(unitId);
    return successState("Reminder restored.");
  } catch (error) {
    return errorState(error, "Could not restore reminder.");
  }
}

export async function completeMaintenanceReminder(
  reminderId: string,
  unitId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = maintenanceCompletionSchema.parse({
      completed_date: value(formData, "completed_date"),
      odometer: value(formData, "odometer"),
      cost: value(formData, "cost"),
      notes: value(formData, "notes"),
    });
    const { data: reminder, error: reminderError } = await supabase
      .from("maintenance_reminders")
      .select("interval_days, interval_miles, fleet_units(odometer)")
      .eq("id", reminderId)
      .eq("unit_id", unitId)
      .is("completed_at", null)
      .single();
    if (reminderError || !reminder) return errorState(reminderError, "Active maintenance reminder not found.");

    const unit = Array.isArray(reminder.fleet_units) ? reminder.fleet_units[0] : reminder.fleet_units;
    if (reminder.interval_miles != null && payload.odometer == null && unit?.odometer == null) {
      return errorState(new Error("Enter the current odometer to schedule the next mileage reminder."));
    }

    const { data: nextReminderId, error } = await supabase.rpc("complete_maintenance_reminder", {
      p_reminder_id: reminderId,
      p_completed_date: payload.completed_date,
      p_odometer: payload.odometer,
      p_notes: payload.notes,
      p_cost: payload.cost,
    });
    if (error) return errorState(error, "Could not complete maintenance.");
    logInfo("maintenance.completed", { reminderId, unitId, userId: user.id });
    revalidateMaintenance(unitId);
    return successState(nextReminderId
      ? "Maintenance completed and the next occurrence was scheduled."
      : "Maintenance completed.");
  } catch (error) {
    return errorState(error, "Could not complete maintenance.");
  }
}

export async function deleteMaintenanceReminder(
  reminderId: string,
  unitId: string,
  _state: ActionState,
): Promise<ActionState> {
  void _state;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from("maintenance_reminders")
      .delete()
      .eq("id", reminderId)
      .eq("unit_id", unitId)
      .is("completed_at", null)
      .select("id")
      .single();
    if (error || !data) return errorState(error, "Active maintenance reminder not found.");
    logInfo("maintenance.schedule.deleted", { reminderId, unitId, userId: user.id });
    revalidateMaintenance(unitId);
    return successState("Maintenance schedule deleted.");
  } catch (error) {
    return errorState(error, "Could not delete maintenance schedule.");
  }
}

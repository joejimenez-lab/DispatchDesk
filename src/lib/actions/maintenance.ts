"use server";

import { revalidatePath } from "next/cache";
import { compensateReceiptUpload, prepareBookkeepingReceipt, type PreparedReceipt } from "@/lib/actions/bookkeeping-storage";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { calculateInitialTargets, isMaintenanceTypeAllowedForUnit, localDateString } from "@/lib/maintenance";
import { logInfo } from "@/lib/logger";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import {
  maintenanceCompletionSchema,
  maintenanceReminderSchema,
  maintenanceSnoozeSchema,
} from "@/lib/validation/schemas";
import type { Json } from "@/types/database";

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
  const groupId = reminderId;
  let prepared: PreparedReceipt | null = null;
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = maintenanceCompletionSchema.parse({
      completed_date: value(formData, "completed_date"),
      odometer: value(formData, "odometer"),
      cost_mode: value(formData, "cost_mode"),
      total_cost: value(formData, "total_cost"),
      labor_cost: value(formData, "labor_cost"),
      parts_cost: value(formData, "parts_cost"),
      vendor: value(formData, "vendor"),
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

    const finalCost = payload.cost_mode === "breakdown"
      ? payload.labor_cost + payload.parts_cost
      : payload.total_cost;
    prepared = await prepareBookkeepingReceipt(supabase, groupId, formData, { idempotencyKey: "completion" });
    if (prepared && finalCost === 0) {
      await compensateReceiptUpload(supabase, prepared, new Error("A receipt requires a positive expense amount."));
      return errorState(new Error("Enter a positive cost before attaching a receipt."));
    }
    const { data: completion, error } = await supabase.rpc("complete_maintenance_with_expense", {
      p_reminder_id: reminderId,
      p_completed_date: payload.completed_date,
      p_odometer: payload.odometer as number,
      p_notes: payload.notes ?? "",
      p_cost_mode: payload.cost_mode,
      p_total_cost: payload.total_cost,
      p_labor_cost: payload.labor_cost,
      p_parts_cost: payload.parts_cost,
      p_vendor: payload.vendor ?? "",
      p_group_id: groupId,
      p_receipt: prepared?.metadata ?? null,
    });
    if (error) {
      await compensateReceiptUpload(supabase, prepared, error);
      return errorState(error, "Could not complete maintenance.");
    }
    const result = completion as { next_reminder_id?: string | null } | null;
    logInfo("maintenance.completed", { reminderId, unitId, userId: user.id });
    revalidateMaintenance(unitId);
    revalidatePath("/bookkeeping");
    revalidatePath("/reports");
    return successState(result?.next_reminder_id
      ? "Maintenance completed, spending recorded, and the next occurrence was scheduled."
      : finalCost > 0 ? "Maintenance completed and spending recorded in Bookkeeping." : "Maintenance completed with no expense.");
  } catch (error) {
    if (prepared) {
      const { supabase } = await createAuthenticatedClient();
      await compensateReceiptUpload(supabase, prepared, error);
    }
    return errorState(error, "Could not complete maintenance.");
  }
}

type MaintenanceRecordTable = "service_records" | "inspection_records" | "repair_logs";

export async function updateMaintenanceSpending(
  table: MaintenanceRecordTable,
  recordId: string,
  unitId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    const payload = maintenanceCompletionSchema.parse({
      completed_date: value(formData, "completed_date"),
      odometer: value(formData, "odometer"),
      cost_mode: value(formData, "cost_mode"),
      total_cost: value(formData, "total_cost"),
      labor_cost: value(formData, "labor_cost"),
      parts_cost: value(formData, "parts_cost"),
      vendor: value(formData, "vendor"),
      notes: value(formData, "notes"),
    });
    const sourceColumn = table === "service_records" ? "service_record_id" : table === "inspection_records" ? "inspection_record_id" : "repair_log_id";
    const { data: group, error: groupError } = await supabase
      .from("bookkeeping_expense_groups")
      .select("id, load_id, driver_id")
      .eq(sourceColumn, recordId)
      .single();
    if (groupError || !group) return errorState(groupError, "This history record is not linked yet. Run Bookkeeping reconciliation first.");
    const lines = payload.cost_mode === "breakdown"
      ? [
        payload.labor_cost > 0 ? { category: "Maintenance", amount: payload.labor_cost, line_type: "labor" } : null,
        payload.parts_cost > 0 ? { category: "Parts", amount: payload.parts_cost, line_type: "parts" } : null,
      ].filter((line) => line !== null)
      : [{ category: "Maintenance", amount: payload.total_cost, line_type: "total" }];
    const finalCost = payload.cost_mode === "breakdown"
      ? payload.labor_cost + payload.parts_cost
      : payload.total_cost;
    if (finalCost <= 0) return errorState(new Error("Linked maintenance spending must stay greater than zero."));
    const expense = {
      expense_date: payload.completed_date,
      vendor: payload.vendor,
      notes: payload.notes,
      unit_id: unitId,
      load_id: group.load_id,
      driver_id: group.driver_id,
      category: "Maintenance",
      amount: finalCost,
      maintenance_table: table,
      maintenance_id: recordId,
    } satisfies Json;
    const { error } = await supabase.rpc("update_bookkeeping_expense_group", { p_group_id: group.id, p_expense: expense, p_lines: lines });
    if (error) return errorState(error, "Could not update maintenance spending.");
    logInfo("maintenance.spending.updated", { recordId, table, groupId: group.id, userId: user.id });
    revalidateMaintenance(unitId);
    revalidatePath("/bookkeeping");
    revalidatePath("/reports");
    return successState("Maintenance and Bookkeeping were updated together.");
  } catch (error) {
    return errorState(error, "Could not update maintenance spending.");
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

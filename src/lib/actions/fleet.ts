"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import {
  inspectionRecordSchema,
  fleetUnitSchema,
  repairLogSchema,
  serviceRecordSchema,
} from "@/lib/validation/schemas";

function value(formData: FormData, key: string) {
  return formData.get(key) ?? "";
}

function unitPayload(formData: FormData) {
  return fleetUnitSchema.parse({
    unit_number: value(formData, "unit_number"),
    unit_type: value(formData, "unit_type"),
    company: value(formData, "company"),
    odometer: value(formData, "odometer"),
    notes: value(formData, "notes"),
  });
}

export async function createUnit(_state: ActionState, formData: FormData): Promise<ActionState> {
  let unitId: string;

  try {
    const { supabase } = await createAuthenticatedClient();
    const { data, error } = await supabase
      .from("fleet_units")
      .insert(unitPayload(formData))
      .select("id")
      .single();
    if (error) return errorState(error, "Could not add unit.");
    unitId = data.id;
  } catch (error) {
    return errorState(error, "Could not add unit.");
  }

  revalidatePath("/fleet");
  redirect(`/fleet/${unitId}`);
}

export async function updateUnit(unitId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("fleet_units").update(unitPayload(formData)).eq("id", unitId);
    if (error) return errorState(error, "Could not save unit.");
    revalidatePath("/fleet");
    revalidatePath(`/fleet/${unitId}`);
    return successState("Unit saved.");
  } catch (error) {
    return errorState(error, "Could not save unit.");
  }
}

export async function deleteUnit(unitId: string, _state: ActionState): Promise<ActionState> {
  void _state;

  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("fleet_units").delete().eq("id", unitId);
    if (error) return errorState(error, "Could not delete unit.");
  } catch (error) {
    return errorState(error, "Could not delete unit.");
  }

  revalidatePath("/fleet");
  redirect("/fleet");
}

export async function addServiceRecord(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const payload = serviceRecordSchema.parse({
      unit_id: value(formData, "unit_id"),
      service_date: value(formData, "service_date"),
      odometer: value(formData, "odometer"),
      description: value(formData, "description"),
      cost: value(formData, "cost"),
      notes: value(formData, "notes"),
    });

    const { error } = await supabase.from("service_records").insert(payload);
    if (error) return errorState(error, "Could not add service record.");
    revalidatePath(`/fleet/${payload.unit_id}`);
    return successState("Service record added.");
  } catch (error) {
    return errorState(error, "Could not add service record.");
  }
}

export async function addInspectionRecord(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const payload = inspectionRecordSchema.parse({
      unit_id: value(formData, "unit_id"),
      inspection_date: value(formData, "inspection_date"),
      odometer: value(formData, "odometer"),
      inspector: value(formData, "inspector"),
      result: value(formData, "result"),
      notes: value(formData, "notes"),
    });

    const { error } = await supabase.from("inspection_records").insert(payload);
    if (error) return errorState(error, "Could not add inspection record.");
    revalidatePath(`/fleet/${payload.unit_id}`);
    return successState("Inspection record added.");
  } catch (error) {
    return errorState(error, "Could not add inspection record.");
  }
}

export async function addRepairLog(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const payload = repairLogSchema.parse({
      unit_id: value(formData, "unit_id"),
      log_type: value(formData, "log_type"),
      repair_date: value(formData, "repair_date"),
      odometer: value(formData, "odometer"),
      description: value(formData, "description"),
      cost: value(formData, "cost"),
      notes: value(formData, "notes"),
    });

    const { error } = await supabase.from("repair_logs").insert(payload);
    if (error) return errorState(error, "Could not add repair log.");
    revalidatePath(`/fleet/${payload.unit_id}`);
    return successState("Repair log added.");
  } catch (error) {
    return errorState(error, "Could not add repair log.");
  }
}

type RecordTable = "service_records" | "inspection_records" | "repair_logs";

export async function deleteFleetRecord(
  table: RecordTable,
  recordId: string,
  unitId: string,
  _state: ActionState,
): Promise<ActionState> {
  void _state;

  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from(table).delete().eq("id", recordId).eq("unit_id", unitId);
    if (error) return errorState(error, "Could not delete record.");
    revalidatePath(`/fleet/${unitId}`);
    return successState("Record deleted.");
  } catch (error) {
    return errorState(error, "Could not delete record.");
  }
}

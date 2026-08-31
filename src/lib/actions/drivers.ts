"use server";

import { revalidatePath } from "next/cache";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { driverSchema } from "@/lib/validation/schemas";
import { importContacts } from "@/lib/contact-import-server";
import type { ContactImportState } from "@/lib/contact-import";
import type { Database } from "@/types/database";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];

function payload(formData: FormData) {
  return driverSchema.parse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    truck_number: formData.get("truck_number") ?? "",
    trailer_number: formData.get("trailer_number") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export async function createDriver(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("drivers").insert(payload(formData));
    if (error) return errorState(error, "Could not add driver.");
    revalidatePath("/drivers");
    return successState("Driver added.");
  } catch (error) {
    return errorState(error, "Could not add driver.");
  }
}

export async function updateDriver(driverId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("drivers").update(payload(formData)).eq("id", driverId);
    if (error) return errorState(error, "Could not save driver.");
    revalidatePath("/drivers");
    return successState("Driver saved.");
  } catch (error) {
    return errorState(error, "Could not save driver.");
  }
}

export async function deleteDriver(driverId: string, _state: ActionState): Promise<ActionState> {
  void _state;

  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("drivers").delete().eq("id", driverId);
    if (error) return errorState(error, "Could not delete driver.");
    revalidatePath("/drivers");
    return successState("Driver deleted.");
  } catch (error) {
    return errorState(error, "Could not delete driver.");
  }
}

function combinedNotes(first: string | null, second: string | null) {
  return Array.from(new Set([first?.trim(), second?.trim()].filter(Boolean))).join("\n\n") || null;
}

function selectedValue(formData: FormData, field: keyof Driver, first: Driver, second: Driver) {
  const choice = formData.get(`${field}_choice`);
  if (choice === "first") return first[field];
  if (choice === "second") return second[field];
  if (field === "notes" && choice === "combine") return combinedNotes(first.notes, second.notes);
  throw new Error(`Choose which ${field.replaceAll("_", " ")} to keep.`);
}

export async function mergeDrivers(
  firstId: string,
  secondId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  try {
    const survivorId = String(formData.get("survivor_id") ?? "");
    if (![firstId, secondId].includes(survivorId) || firstId === secondId) throw new Error("Choose the driver record to keep.");
    const { supabase } = await createAuthenticatedClient();
    const { data, error } = await supabase.from("drivers").select("*").in("id", [firstId, secondId]);
    if (error) return errorState(error, "Could not load the driver records.");
    if (data.length !== 2) return errorState(new Error("Both driver records must be available in this workspace."));
    const first = data.find((record) => record.id === firstId) as Driver;
    const second = data.find((record) => record.id === secondId) as Driver;
    const survivor = survivorId === first.id ? first : second;
    const duplicate = survivorId === first.id ? second : first;
    const values = {
      name: selectedValue(formData, "name", first, second),
      phone: selectedValue(formData, "phone", first, second),
      email: selectedValue(formData, "email", first, second),
      truck_number: selectedValue(formData, "truck_number", first, second),
      trailer_number: selectedValue(formData, "trailer_number", first, second),
      notes: selectedValue(formData, "notes", first, second),
    };
    const parsed = driverSchema.parse(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? ""])));
    const { error: mergeError } = await supabase.rpc("merge_driver_records", {
      p_survivor_id: survivor.id,
      p_duplicate_id: duplicate.id,
      p_values: parsed,
    });
    if (mergeError) return errorState(mergeError, "Could not merge the driver records.");
    revalidatePath("/drivers");
    revalidatePath("/loads");
    revalidatePath("/bookkeeping");
    revalidatePath("/reports");
    return successState("Driver records merged. Related loads and expenses now use the surviving record.");
  } catch (error) {
    return errorState(error, "Could not merge the driver records.");
  }
}

export async function importDrivers(_state: ContactImportState, formData: FormData): Promise<ContactImportState> {
  return importContacts("driver", formData);
}

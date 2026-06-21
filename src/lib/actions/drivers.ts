"use server";

import { revalidatePath } from "next/cache";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { driverSchema } from "@/lib/validation/schemas";

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

"use server";

import { revalidatePath } from "next/cache";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { brokerSchema } from "@/lib/validation/schemas";

function payload(formData: FormData) {
  return brokerSchema.parse({
    company_name: formData.get("company_name") ?? "",
    contact_name: formData.get("contact_name") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export async function createBroker(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("brokers").insert(payload(formData));
    if (error) return errorState(error, "Could not add broker.");
    revalidatePath("/brokers");
    return successState("Broker added.");
  } catch (error) {
    return errorState(error, "Could not add broker.");
  }
}

export async function updateBroker(brokerId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("brokers").update(payload(formData)).eq("id", brokerId);
    if (error) return errorState(error, "Could not save broker.");
    revalidatePath("/brokers");
    return successState("Broker saved.");
  } catch (error) {
    return errorState(error, "Could not save broker.");
  }
}

export async function deleteBroker(brokerId: string, _state: ActionState): Promise<ActionState> {
  void _state;

  try {
    const { supabase } = await createAuthenticatedClient();
    const { error } = await supabase.from("brokers").delete().eq("id", brokerId);
    if (error) return errorState(error, "Could not delete broker.");
    revalidatePath("/brokers");
    return successState("Broker deleted.");
  } catch (error) {
    return errorState(error, "Could not delete broker.");
  }
}

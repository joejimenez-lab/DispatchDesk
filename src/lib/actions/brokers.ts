"use server";

import { revalidatePath } from "next/cache";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import { errorState, successState, type ActionState } from "@/lib/actions/state";
import { brokerSchema } from "@/lib/validation/schemas";
import { importContacts } from "@/lib/contact-import-server";
import type { ContactImportState } from "@/lib/contact-import";
import type { Database } from "@/types/database";

type Broker = Database["public"]["Tables"]["brokers"]["Row"];

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

function combinedNotes(first: string | null, second: string | null) {
  return Array.from(new Set([first?.trim(), second?.trim()].filter(Boolean))).join("\n\n") || null;
}

function selectedValue(formData: FormData, field: keyof Broker, first: Broker, second: Broker) {
  const choice = formData.get(`${field}_choice`);
  if (choice === "first") return first[field];
  if (choice === "second") return second[field];
  if (field === "notes" && choice === "combine") return combinedNotes(first.notes, second.notes);
  throw new Error(`Choose which ${field.replaceAll("_", " ")} to keep.`);
}

export async function mergeBrokers(
  firstId: string,
  secondId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _state;
  try {
    const survivorId = String(formData.get("survivor_id") ?? "");
    if (![firstId, secondId].includes(survivorId) || firstId === secondId) throw new Error("Choose the broker record to keep.");
    const { supabase } = await createAuthenticatedClient();
    const { data, error } = await supabase.from("brokers").select("*").in("id", [firstId, secondId]);
    if (error) return errorState(error, "Could not load the broker records.");
    if (data.length !== 2) return errorState(new Error("Both broker records must be available in this workspace."));
    const first = data.find((record) => record.id === firstId) as Broker;
    const second = data.find((record) => record.id === secondId) as Broker;
    const survivor = survivorId === first.id ? first : second;
    const duplicate = survivorId === first.id ? second : first;
    const values = {
      company_name: selectedValue(formData, "company_name", first, second),
      contact_name: selectedValue(formData, "contact_name", first, second),
      phone: selectedValue(formData, "phone", first, second),
      email: selectedValue(formData, "email", first, second),
      notes: selectedValue(formData, "notes", first, second),
    };
    const parsed = brokerSchema.parse(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? ""])));
    const { error: mergeError } = await supabase.rpc("merge_broker_records", {
      p_survivor_id: survivor.id,
      p_duplicate_id: duplicate.id,
      p_values: parsed,
    });
    if (mergeError) return errorState(mergeError, "Could not merge the broker records.");
    revalidatePath("/brokers");
    revalidatePath("/loads");
    revalidatePath("/reports");
    return successState("Broker records merged. Related loads now use the surviving record.");
  } catch (error) {
    return errorState(error, "Could not merge the broker records.");
  }
}

export async function importBrokers(_state: ContactImportState, formData: FormData): Promise<ContactImportState> {
  return importContacts("broker", formData);
}

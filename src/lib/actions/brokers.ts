"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

export async function createBroker(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("brokers").insert(payload(formData));
  if (error) throw new Error(error.message);
  revalidatePath("/brokers");
}

export async function updateBroker(brokerId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("brokers").update(payload(formData)).eq("id", brokerId);
  if (error) throw new Error(error.message);
  revalidatePath("/brokers");
}

export async function deleteBroker(brokerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("brokers").delete().eq("id", brokerId);
  if (error) throw new Error(error.message);
  revalidatePath("/brokers");
}

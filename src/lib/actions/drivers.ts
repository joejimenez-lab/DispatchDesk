"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

export async function createDriver(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").insert(payload(formData));
  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}

export async function updateDriver(driverId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").update(payload(formData)).eq("id", driverId);
  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}

export async function deleteDriver(driverId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").delete().eq("id", driverId);
  if (error) throw new Error(error.message);
  revalidatePath("/drivers");
}

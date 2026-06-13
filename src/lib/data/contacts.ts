import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Broker = Database["public"]["Tables"]["brokers"]["Row"];

export async function getDrivers(q?: string) {
  const supabase = await createClient();
  let query = supabase.from("drivers").select("*").order("name");
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,truck_number.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Driver[];
}

export async function getBrokers(q?: string) {
  const supabase = await createClient();
  let query = supabase.from("brokers").select("*").order("company_name");
  if (q) query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Broker[];
}

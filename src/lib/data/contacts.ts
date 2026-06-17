import { createClient } from "@/lib/supabase/server";
import { ilikeOr, searchTokens } from "@/lib/search";
import type { Database } from "@/types/database";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Broker = Database["public"]["Tables"]["brokers"]["Row"];

const DRIVER_SEARCH_COLUMNS = ["name", "phone", "email", "truck_number"];
const BROKER_SEARCH_COLUMNS = ["company_name", "contact_name", "phone", "email"];

export async function getDrivers(q?: string) {
  const supabase = await createClient();
  let query = supabase.from("drivers").select("*").order("name");
  for (const token of searchTokens(q)) {
    query = query.or(ilikeOr(DRIVER_SEARCH_COLUMNS, token));
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Driver[];
}

export async function getBrokers(q?: string) {
  const supabase = await createClient();
  let query = supabase.from("brokers").select("*").order("company_name");
  for (const token of searchTokens(q)) {
    query = query.or(ilikeOr(BROKER_SEARCH_COLUMNS, token));
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Broker[];
}

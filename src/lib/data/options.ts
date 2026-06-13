import { createClient } from "@/lib/supabase/server";

export async function getFormOptions() {
  const supabase = await createClient();
  const [drivers, brokers] = await Promise.all([
    supabase.from("drivers").select("id, name").order("name"),
    supabase.from("brokers").select("id, company_name").order("company_name"),
  ]);

  if (drivers.error) throw drivers.error;
  if (brokers.error) throw brokers.error;

  return {
    drivers: (drivers.data ?? []) as { id: string; name: string }[],
    brokers: (brokers.data ?? []) as { id: string; company_name: string }[],
  };
}

import { createClient } from "@/lib/supabase/server";

export type LoadDriverOption = {
  id: string;
  name: string;
  truck_number: string | null;
  trailer_number: string | null;
};

export type LoadEquipmentOption = {
  id: string;
  unit_number: string;
  unit_type: "Truck" | "Trailer";
  company: string | null;
};

export async function getFormOptions() {
  const supabase = await createClient();
  const [drivers, brokers, equipment] = await Promise.all([
    supabase.from("drivers").select("id, name, truck_number, trailer_number").order("name"),
    supabase.from("brokers").select("id, company_name").order("company_name"),
    supabase.from("fleet_units").select("id, unit_number, unit_type, company").order("unit_type").order("unit_number"),
  ]);

  if (drivers.error) throw drivers.error;
  if (brokers.error) throw brokers.error;
  if (equipment.error) throw equipment.error;

  return {
    drivers: (drivers.data ?? []) as LoadDriverOption[],
    brokers: (brokers.data ?? []) as { id: string; company_name: string }[],
    equipment: (equipment.data ?? []) as LoadEquipmentOption[],
  };
}

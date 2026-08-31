import { createClient } from "@/lib/supabase/server";
import { applyFleetScope, type FleetScope } from "@/lib/fleet-scope";
import type { Database } from "@/types/database";

type Load = Database["public"]["Tables"]["loads"]["Row"];
type Stop = Database["public"]["Tables"]["load_stops"]["Row"];

export type DispatchBoardLoad = Load & {
  drivers: { name: string } | null;
  brokers: { company_name: string } | null;
  load_stops: Stop[];
};

export async function getDispatchBoardLoads(fleetScope: FleetScope) {
  const supabase = await createClient();
  let query = supabase
    .from("loads")
    .select("*, drivers(name), brokers(company_name), load_stops(*)")
    .in("status", ["Booked", "Dispatched", "Picked Up", "In Transit"])
    .order("delivery_date", { ascending: true, nullsFirst: false });
  query = applyFleetScope(query, fleetScope);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as DispatchBoardLoad[]).map((load) => ({
    ...load,
    load_stops: [...load.load_stops].sort((first, second) => first.position - second.position),
  }));
}

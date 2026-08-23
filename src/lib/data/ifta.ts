import { buildRouteTemplates, type IftaStateMilesEntry } from "@/lib/ifta";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { matchesFleetScope, type FleetScope } from "@/lib/fleet-scope";

type TripRow = Database["public"]["Tables"]["ifta_trips"]["Row"];
type FuelPurchaseRow = Database["public"]["Tables"]["ifta_fuel_purchases"]["Row"];

type IftaUnit = { id: string; unit_number: string; company: string | null } | null;
export type IftaTripWithMiles = TripRow & { ifta_trip_miles: IftaStateMilesEntry[]; fleet_units: IftaUnit };
export type IftaFuelPurchase = FuelPurchaseRow & {
  bookkeeping_expense_groups?: { id: string; bookkeeping_receipts: { id: string }[] }[];
  fleet_units: IftaUnit;
};

export type IftaPeriodFilters = {
  start: string;
  end: string;
  truck?: string;
  fleetScope?: FleetScope;
};

export async function getIftaTrips({ start, end, truck, fleetScope = { kind: "all" } }: IftaPeriodFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("ifta_trips")
    .select("*, ifta_trip_miles(state, miles), fleet_units(id, unit_number, company)")
    .gte("start_date", start)
    .lte("start_date", end)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (truck) query = query.eq("truck_number", truck);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as IftaTripWithMiles[]).filter((row) => matchesFleetScope(row.fleet_units?.company, fleetScope));
}

export async function getIftaFuelPurchases({ start, end, truck, fleetScope = { kind: "all" } }: IftaPeriodFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("ifta_fuel_purchases")
    .select("*, bookkeeping_expense_groups(id, bookkeeping_receipts(id)), fleet_units(id, unit_number, company)")
    .gte("purchase_date", start)
    .lte("purchase_date", end)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (truck) query = query.eq("truck_number", truck);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as IftaFuelPurchase[]).filter((row) => matchesFleetScope(row.fleet_units?.company, fleetScope));
}

export async function getIftaTruckOptions(scope: FleetScope = { kind: "all" }) {
  const supabase = await createClient();
  const query = supabase.from("fleet_units").select("id, unit_number, company").eq("unit_type", "Truck").order("unit_number");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).filter((row) => matchesFleetScope(row.company, scope));
}

export async function getIftaTruckNumbers(scope: FleetScope = { kind: "all" }) {
  const units = await getIftaTruckOptions(scope);
  const numbers = new Set(units.map((row) => row.unit_number));
  return [...numbers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export async function getIftaRouteTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ifta_trips")
    .select("pickup_city, dropoff_city, ifta_trip_miles(state, miles)")
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return buildRouteTemplates(
    (data ?? []) as { pickup_city: string; dropoff_city: string; ifta_trip_miles: IftaStateMilesEntry[] }[],
  );
}

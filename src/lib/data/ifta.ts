import { buildRouteTemplates, type IftaStateMilesEntry } from "@/lib/ifta";
import { getFleetTruckNumbers } from "@/lib/data/fleet";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TripRow = Database["public"]["Tables"]["ifta_trips"]["Row"];
type FuelPurchaseRow = Database["public"]["Tables"]["ifta_fuel_purchases"]["Row"];

export type IftaTripWithMiles = TripRow & { ifta_trip_miles: IftaStateMilesEntry[] };
export type IftaFuelPurchase = FuelPurchaseRow;

export type IftaPeriodFilters = {
  start: string;
  end: string;
  truck?: string;
  fleet?: string;
};

async function resolveTruckFilter(truck?: string, fleet?: string) {
  if (truck) return [truck];
  if (!fleet) return null;
  return getFleetTruckNumbers(fleet);
}

export async function getIftaTrips({ start, end, truck, fleet }: IftaPeriodFilters) {
  const supabase = await createClient();
  const truckFilter = await resolveTruckFilter(truck, fleet);
  if (truckFilter && !truckFilter.length) return [];

  let query = supabase
    .from("ifta_trips")
    .select("*, ifta_trip_miles(state, miles)")
    .gte("start_date", start)
    .lte("start_date", end)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (truckFilter) query = query.in("truck_number", truckFilter);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as IftaTripWithMiles[];
}

export async function getIftaFuelPurchases({ start, end, truck, fleet }: IftaPeriodFilters) {
  const supabase = await createClient();
  const truckFilter = await resolveTruckFilter(truck, fleet);
  if (truckFilter && !truckFilter.length) return [];

  let query = supabase
    .from("ifta_fuel_purchases")
    .select("*")
    .gte("purchase_date", start)
    .lte("purchase_date", end)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (truckFilter) query = query.in("truck_number", truckFilter);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as IftaFuelPurchase[];
}

export async function getIftaTruckNumbers(fleet?: string) {
  if (fleet) return getFleetTruckNumbers(fleet);

  const supabase = await createClient();
  const [units, trips, purchases] = await Promise.all([
    supabase.from("fleet_units").select("unit_number").eq("unit_type", "Truck"),
    supabase.from("ifta_trips").select("truck_number"),
    supabase.from("ifta_fuel_purchases").select("truck_number"),
  ]);

  if (units.error) throw units.error;
  if (trips.error) throw trips.error;
  if (purchases.error) throw purchases.error;

  const numbers = new Set([
    ...(units.data ?? []).map((row) => row.unit_number),
    ...(trips.data ?? []).map((row) => row.truck_number),
    ...(purchases.data ?? []).map((row) => row.truck_number),
  ]);
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

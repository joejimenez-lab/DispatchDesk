import {
  buildRouteTemplates,
  type IftaFuelDraftPayload,
  type IftaStateMilesEntry,
  type IftaTripDraftPayload,
} from "@/lib/ifta";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { matchesFleetScope, type FleetScope } from "@/lib/fleet-scope";

type TripRow = Database["public"]["Tables"]["ifta_trips"]["Row"];
type FuelPurchaseRow = Database["public"]["Tables"]["ifta_fuel_purchases"]["Row"];

type IftaUnit = { id: string; unit_number: string; company: string | null } | null;
export type IftaTripWithMiles = TripRow & {
  ifta_trip_miles: IftaStateMilesEntry[];
  fleet_units: IftaUnit;
  loads: { id: string; load_number: string } | null;
};
export type IftaFuelPurchase = FuelPurchaseRow & {
  posted_bookkeeping?: { id: string; bookkeeping_receipts: { id: string }[] }[];
  source_bookkeeping?: { id: string; bookkeeping_receipts: { id: string }[] } | null;
  fleet_units: IftaUnit;
};

type DraftRow = Database["public"]["Tables"]["ifta_drafts"]["Row"];
export type IftaDraft = Omit<DraftRow, "payload"> & {
  payload: IftaTripDraftPayload | IftaFuelDraftPayload;
  loads: { id: string; load_number: string } | null;
  bookkeeping_expense_groups: {
    id: string;
    bookkeeping_receipts: { id: string }[];
  } | null;
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
    .select("*, ifta_trip_miles(state, miles), fleet_units(id, unit_number, company), loads!ifta_trips_source_load_id_fkey(id, load_number)")
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
    .select(`
      *,
      posted_bookkeeping:bookkeeping_expense_groups!bookkeeping_expense_groups_ifta_fuel_purchase_id_fkey(id, bookkeeping_receipts(id)),
      source_bookkeeping:bookkeeping_expense_groups!ifta_fuel_purchases_source_expense_group_id_fkey(id, bookkeeping_receipts(id)),
      fleet_units(id, unit_number, company)
    `)
    .gte("purchase_date", start)
    .lte("purchase_date", end)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (truck) query = query.eq("truck_number", truck);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as IftaFuelPurchase[]).filter((row) => matchesFleetScope(row.fleet_units?.company, fleetScope));
}

export async function getIftaDrafts({ start, end, truck, fleetScope = { kind: "all" } }: IftaPeriodFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("ifta_drafts")
    .select(`
      *,
      loads!ifta_drafts_source_load_id_fkey(id, load_number),
      bookkeeping_expense_groups!ifta_drafts_source_expense_group_id_fkey(
        id,
        bookkeeping_receipts(id)
      )
    `)
    .gte("report_date", start)
    .lte("report_date", end)
    .order("status", { ascending: true })
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (truck) query = query.contains("payload", { truck_number: truck });
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as IftaDraft[];
  if (fleetScope.kind === "all") return rows;

  const unitIds = [...new Set(rows.map((row) => String(row.payload.unit_id ?? "")).filter(Boolean))];
  if (!unitIds.length) return fleetScope.kind === "unassigned" ? rows : [];
  const { data: units, error: unitsError } = await supabase
    .from("fleet_units")
    .select("id, company")
    .in("id", unitIds);
  if (unitsError) throw unitsError;
  const companies = new Map((units ?? []).map((unit) => [unit.id, unit.company]));
  return rows.filter((row) => matchesFleetScope(companies.get(String(row.payload.unit_id ?? "")) ?? null, fleetScope));
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

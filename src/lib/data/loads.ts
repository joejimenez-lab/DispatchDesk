import { notFound } from "next/navigation";
import { isMissingPostgrestRow } from "@/lib/data/not-found";
import { createClient } from "@/lib/supabase/server";
import { ilikeOr, searchTokens } from "@/lib/search";
import { isClientPaymentPaid } from "@/lib/financials";
import type { Database, LoadCloseoutStatus, LoadStatus } from "@/types/database";
import { applyFleetScope, type FleetScope } from "@/lib/fleet-scope";
import { scheduleWindow, type AssignmentWindow, type DispatchStop } from "@/lib/dispatch";

const LOAD_SEARCH_COLUMNS = [
  "load_number",
  "pickup_location",
  "delivery_location",
  "return_location",
  "carrier_company",
  "fleet_company",
  "truck_number",
  "trailer_number",
  "commodity",
  "special_instructions",
];
const STOP_SEARCH_COLUMNS = ["location", "appointment_number", "reference_number", "instructions"];

type LoadRow = Database["public"]["Tables"]["loads"]["Row"];
type PaymentRow = Pick<
  Database["public"]["Tables"]["payments"]["Row"],
  "client_paid" | "client_amount_received" | "driver_paid" | "dispatcher_paid"
>;
type LoadListItem = LoadRow & {
  brokers: { company_name: string } | null;
  drivers: { name: string } | null;
  payments: PaymentRow | PaymentRow[] | null;
  load_stops: Database["public"]["Tables"]["load_stops"]["Row"][];
};
type LoadDetail = LoadRow & {
  brokers: Database["public"]["Tables"]["brokers"]["Row"] | null;
  drivers: Database["public"]["Tables"]["drivers"]["Row"] | null;
  payments: Database["public"]["Tables"]["payments"]["Row"] | Database["public"]["Tables"]["payments"]["Row"][] | null;
  load_deductions: Database["public"]["Tables"]["load_deductions"]["Row"][];
  load_stops: Database["public"]["Tables"]["load_stops"]["Row"][];
};
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activity_logs"]["Row"];

export async function getLoads(params: {
  q?: string;
  status?: string;
  broker?: string;
  driver?: string;
  payment?: string;
  closeout?: string;
  fleetScope?: FleetScope;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("loads")
    .select("*, brokers(company_name), drivers(name), payments(client_paid, client_amount_received, driver_paid, dispatcher_paid), load_stops(*)")
    .order("delivery_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  // A closeout filter defines Delivered work and takes precedence over an old
  // operational-status query parameter retained in a bookmarked URL.
  if (params.status && !params.closeout) query = query.eq("status", params.status as LoadStatus);
  if (params.broker) query = query.eq("broker_id", params.broker);
  if (params.driver) query = query.eq("driver_id", params.driver);
  if (params.closeout === "all-open") {
    query = query.eq("status", "Delivered").or("post_delivery_status.is.null,post_delivery_status.neq.Closed");
  } else if (params.closeout) {
    query = query.eq("post_delivery_status", params.closeout as LoadCloseoutStatus);
  }
  if (params.fleetScope) query = applyFleetScope(query, params.fleetScope);
  // Each token must match at least one column; chained `.or()` calls are ANDed
  // together, so "Dallas Memphis" matches a load whose lane spans both cities.
  for (const token of searchTokens(params.q)) {
    const stopMatches = await supabase.from("load_stops").select("load_id").or(ilikeOr(STOP_SEARCH_COLUMNS, token));
    if (stopMatches.error) throw stopMatches.error;
    const stopLoadIds = [...new Set((stopMatches.data ?? []).map((stop) => stop.load_id))];
    query = query.or([ilikeOr(LOAD_SEARCH_COLUMNS, token), stopLoadIds.length ? `id.in.(${stopLoadIds.join(",")})` : null].filter(Boolean).join(","));
  }

  const { data, error } = await query;
  if (error) throw error;
  const loads = (data ?? []) as unknown as LoadListItem[];

  if (params.payment === "paid") {
    return loads.filter((load) => isLoadClientPaymentPaid(load));
  }

  if (params.payment === "unpaid") {
    return loads.filter((load) => !isLoadClientPaymentPaid(load) && load.status !== "Cancelled");
  }

  return loads;
}

export function loadPayment(load: Pick<LoadListItem, "payments">) {
  return Array.isArray(load.payments) ? load.payments[0] : load.payments;
}

export function isLoadClientPaymentPaid(load: Pick<LoadListItem, "load_rate" | "payments">) {
  return isClientPaymentPaid(load.load_rate, loadPayment(load));
}

export async function getLoad(loadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select("*, brokers(*), drivers(*), payments(*), load_deductions(*), load_stops(*)")
    .eq("id", loadId)
    .single();

  if (isMissingPostgrestRow(error) || (!error && !data)) notFound();
  if (error) throw error;
  const load = data as unknown as LoadDetail;
  return {
    ...load,
    load_deductions: [...load.load_deductions].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    load_stops: [...load.load_stops].sort((a, b) => a.position - b.position),
  };
}

type AssignmentLoad = Pick<LoadRow, "id" | "load_number" | "driver_id" | "truck_unit_id" | "truck_number" | "trailer_unit_id" | "trailer_number"> & {
  drivers: { name: string } | null;
  load_stops: Database["public"]["Tables"]["load_stops"]["Row"][];
};

export async function getAssignmentWindows(): Promise<AssignmentWindow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select("id, load_number, driver_id, truck_unit_id, truck_number, trailer_unit_id, trailer_number, drivers(name), load_stops(*)")
    .in("status", ["Booked", "Dispatched", "Picked Up", "In Transit"]);
  if (error) throw error;
  return ((data ?? []) as unknown as AssignmentLoad[]).flatMap((load) => {
    const window = scheduleWindow(load.load_stops as DispatchStop[]);
    return window ? [{
      loadId: load.id,
      loadNumber: load.load_number,
      driverId: load.driver_id,
      driverName: load.drivers?.name ?? null,
      truckUnitId: load.truck_unit_id,
      truckNumber: load.truck_number,
      trailerUnitId: load.trailer_unit_id,
      trailerNumber: load.trailer_number,
      ...window,
    }] : [];
  });
}

export async function getLoadRelated(loadId: string) {
  const supabase = await createClient();
  const [documents, notes, activity] = await Promise.all([
    supabase.from("documents").select("*").eq("load_id", loadId).order("created_at", { ascending: false }),
    supabase.from("notes").select("*").eq("load_id", loadId).order("created_at", { ascending: false }),
    supabase.from("activity_logs").select("*").eq("load_id", loadId).order("created_at", { ascending: false }),
  ]);

  if (documents.error) throw documents.error;
  if (notes.error) throw notes.error;
  if (activity.error) throw activity.error;

  return {
    documents: (documents.data ?? []) as DocumentRow[],
    notes: (notes.data ?? []) as NoteRow[],
    activity: (activity.data ?? []) as ActivityRow[],
  };
}

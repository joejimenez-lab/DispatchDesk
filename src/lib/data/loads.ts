import { notFound } from "next/navigation";
import { isMissingPostgrestRow } from "@/lib/data/not-found";
import { createClient } from "@/lib/supabase/server";
import { ilikeOr, searchTokens } from "@/lib/search";
import type { Database, LoadStatus } from "@/types/database";

const LOAD_SEARCH_COLUMNS = ["load_number", "pickup_location", "delivery_location", "return_location", "carrier_company"];

type LoadRow = Database["public"]["Tables"]["loads"]["Row"];
type PaymentRow = Pick<Database["public"]["Tables"]["payments"]["Row"], "client_paid" | "driver_paid" | "dispatcher_paid">;
type LoadListItem = LoadRow & {
  brokers: { company_name: string } | null;
  drivers: { name: string } | null;
  payments: PaymentRow | PaymentRow[] | null;
};
type LoadDetail = LoadRow & {
  brokers: Database["public"]["Tables"]["brokers"]["Row"] | null;
  drivers: Database["public"]["Tables"]["drivers"]["Row"] | null;
  payments: Database["public"]["Tables"]["payments"]["Row"] | Database["public"]["Tables"]["payments"]["Row"][] | null;
};
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activity_logs"]["Row"];

export async function getLoads(params: {
  q?: string;
  status?: string;
  broker?: string;
  driver?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("loads")
    .select("*, brokers(company_name), drivers(name), payments(client_paid, driver_paid, dispatcher_paid)")
    .order("delivery_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status as LoadStatus);
  if (params.broker) query = query.eq("broker_id", params.broker);
  if (params.driver) query = query.eq("driver_id", params.driver);
  // Each token must match at least one column; chained `.or()` calls are ANDed
  // together, so "Dallas Memphis" matches a load whose lane spans both cities.
  for (const token of searchTokens(params.q)) {
    query = query.or(ilikeOr(LOAD_SEARCH_COLUMNS, token));
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as LoadListItem[];
}

export async function getLoad(loadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select("*, brokers(*), drivers(*), payments(*)")
    .eq("id", loadId)
    .single();

  if (isMissingPostgrestRow(error) || (!error && !data)) notFound();
  if (error) throw error;
  return data as unknown as LoadDetail;
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

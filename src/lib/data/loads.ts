import { notFound } from "next/navigation";
import { isMissingPostgrestRow } from "@/lib/data/not-found";
import { createClient } from "@/lib/supabase/server";
import { isClientPaymentPaid } from "@/lib/financials";
import type { Database } from "@/types/database";
import type { FleetScope } from "@/lib/fleet-scope";
import { scheduleWindow, type AssignmentWindow, type DispatchStop } from "@/lib/dispatch";
import type { Pagination } from "@/lib/pagination";
import { getLoadIndexPage, normalizeLoadView } from "@/lib/data/load-index";

export { normalizeLoadView } from "@/lib/data/load-index";

type LoadRow = Database["public"]["Tables"]["loads"]["Row"];
type PaymentRow = Pick<
  Database["public"]["Tables"]["payments"]["Row"],
  "invoice_status" | "client_paid" | "client_amount_received" | "driver_paid" | "dispatcher_paid"
>;
export type LoadListItem = LoadRow & {
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
  receivable_entries: Database["public"]["Tables"]["receivable_entries"]["Row"][];
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
  financial?: string;
  fleetScope?: FleetScope;
  pagination?: Pagination;
}) {
  const supabase = await createClient();
  const pagination = params.pagination ?? { page: 1, pageSize: 25 };
  const view = normalizeLoadView(params.status);
  const index = await getLoadIndexPage(supabase, { ...params, status: view }, pagination);
  if (!index.ids.length) return { items: [] as LoadListItem[], total: index.total, ...pagination };

  const { data, error } = await supabase
    .from("loads")
    .select("*, brokers(company_name), drivers(name), payments(invoice_status, client_paid, client_amount_received, driver_paid, dispatcher_paid), load_stops(*)")
    .in("id", index.ids);
  if (error) throw error;
  const byId = new Map(((data ?? []) as unknown as LoadListItem[]).map((load) => [load.id, load]));
  return { items: index.ids.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []), total: index.total, ...pagination };
}

export function loadPayment(load: Pick<LoadListItem, "payments">) {
  return Array.isArray(load.payments) ? load.payments[0] : load.payments;
}

export function isLoadClientPaymentPaid(load: Pick<LoadListItem, "load_rate" | "payments">) {
  const payment = loadPayment(load);
  return payment?.invoice_status !== "Void" && isClientPaymentPaid(load.load_rate, payment);
}

export async function getLoad(loadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select("*, brokers(*), drivers(*), payments(*), load_deductions(*), load_stops(*), receivable_entries(*)")
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

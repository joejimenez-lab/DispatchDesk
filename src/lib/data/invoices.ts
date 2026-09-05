import { notFound } from "next/navigation";
import { isMissingPostgrestRow } from "@/lib/data/not-found";
import { matchesFleetScope, type FleetScope } from "@/lib/fleet-scope";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type LoadRow = Database["public"]["Tables"]["loads"]["Row"];
type InvoiceLoad = LoadRow & { brokers: { company_name: string } | null };
export type InvoiceRecord = PaymentRow & { loads: InvoiceLoad };
export type InvoiceLoadOption = Pick<LoadRow, "id" | "load_number" | "fleet_company" | "load_rate" | "pickup_location" | "delivery_location"> & {
  brokers: { company_name: string } | null;
  payments: Pick<PaymentRow, "invoice_status"> | Pick<PaymentRow, "invoice_status">[] | null;
};

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export async function getInvoices(scope: FleetScope, search?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, loads!payments_load_id_fkey(*, brokers!loads_broker_id_fkey(company_name))")
    .not("invoice_status", "is", null)
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const query = normalized(search);
  return ((data ?? []) as unknown as InvoiceRecord[]).filter((invoice) => {
    if (!matchesFleetScope(invoice.loads.fleet_company, scope)) return false;
    if (!query) return true;
    return [
      invoice.invoice_number,
      invoice.loads.load_number,
      invoice.loads.brokers?.company_name,
      invoice.loads.pickup_location,
      invoice.loads.delivery_location,
    ].some((candidate) => normalized(candidate).includes(query));
  });
}

export async function getInvoice(loadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, loads!payments_load_id_fkey(*, brokers!loads_broker_id_fkey(company_name))")
    .eq("load_id", loadId)
    .not("invoice_status", "is", null)
    .single();
  if (isMissingPostgrestRow(error) || (!error && !data)) notFound();
  if (error) throw error;
  return data as unknown as InvoiceRecord;
}

export async function getInvoiceLoadOptions(scope: FleetScope) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loads")
    .select("id, load_number, fleet_company, load_rate, pickup_location, delivery_location, brokers!loads_broker_id_fkey(company_name), payments!payments_load_id_fkey(invoice_status)")
    .neq("status", "Cancelled")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as InvoiceLoadOption[]).filter((load) => {
    const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
    return matchesFleetScope(load.fleet_company, scope) && !payment?.invoice_status;
  });
}

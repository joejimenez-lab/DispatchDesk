import { createClient } from "@/lib/supabase/server";
import { agingBucket, agingBuckets, daysPastDue, isOverdue, receivableBalance, type AgingBucket, type ReceivableEntry } from "@/lib/collections";
import { applyFleetScope, type FleetScope } from "@/lib/fleet-scope";
import type { Database } from "@/types/database";

type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Entry = Database["public"]["Tables"]["receivable_entries"]["Row"];
type Contact = Database["public"]["Tables"]["collection_contacts"]["Row"];

type CollectionLoadRow = Pick<Database["public"]["Tables"]["loads"]["Row"], "id" | "load_number" | "load_rate" | "delivery_date" | "fleet_company" | "status"> & {
  brokers: { id: string; company_name: string } | null;
  payments: Payment | Payment[] | null;
  receivable_entries: Entry[];
};

export type CollectionInvoice = Omit<CollectionLoadRow, "payments"> & {
  payment: Payment;
  balance: number;
  bucket: AgingBucket;
  daysPastDue: number;
  overdue: boolean;
  ownerName: string | null;
};

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function getCollections(scope: FleetScope = { kind: "all" }) {
  const supabase = await createClient();
  let query = supabase
    .from("loads")
    .select("id, load_number, load_rate, delivery_date, fleet_company, status, brokers(id, company_name), payments(*), receivable_entries(*)")
    .neq("status", "Cancelled")
    .order("delivery_date", { ascending: true, nullsFirst: false });
  query = applyFleetScope(query, scope);
  const [loadsResult, profilesResult] = await Promise.all([
    query,
    supabase.rpc("collection_owner_options"),
  ]);
  if (loadsResult.error) throw loadsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const owners = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name || profile.email]));
  const asOf = today();
  const invoices = ((loadsResult.data ?? []) as unknown as CollectionLoadRow[]).flatMap((load) => {
    const payment = relation(load.payments);
    if (!payment || payment.invoice_status === "Void") return [];
    const balance = receivableBalance(load.load_rate, load.receivable_entries as ReceivableEntry[]);
    if (balance <= 0) return [];
    return [{
      ...load,
      payment,
      balance,
      bucket: agingBucket(payment.due_date, asOf),
      daysPastDue: daysPastDue(payment.due_date, asOf),
      overdue: balance > 0 && isOverdue(payment.due_date, asOf),
      ownerName: payment.collection_owner_id ? owners.get(payment.collection_owner_id) ?? "Unknown member" : null,
    }];
  });
  const aging = Object.fromEntries(agingBuckets.map((bucket) => [bucket, invoices.filter((invoice) => invoice.bucket === bucket).reduce((sum, invoice) => sum + invoice.balance, 0)])) as Record<AgingBucket, number>;
  const customers = [...invoices.reduce((groups, invoice) => {
    const id = invoice.brokers?.id ?? "unassigned";
    const current = groups.get(id) ?? { id, name: invoice.brokers?.company_name ?? "Unassigned customer", balance: 0, overdue: 0, invoices: 0 };
    current.balance += invoice.balance;
    current.overdue += invoice.overdue ? invoice.balance : 0;
    current.invoices += 1;
    groups.set(id, current);
    return groups;
  }, new Map<string, { id: string; name: string; balance: number; overdue: number; invoices: number }>()).values()].sort((a, b) => b.balance - a.balance);
  return { invoices, aging, customers, owners: profilesResult.data ?? [], asOf, total: invoices.reduce((sum, invoice) => sum + invoice.balance, 0) };
}

export async function getCollectionDetail(loadId: string) {
  const supabase = await createClient();
  const [loadResult, entriesResult, contactsResult, profilesResult] = await Promise.all([
    supabase.from("loads").select("id, load_number, load_rate, status, brokers(company_name), payments(*)").eq("id", loadId).single(),
    supabase.from("receivable_entries").select("*").eq("load_id", loadId).order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("collection_contacts").select("*").eq("load_id", loadId).order("contacted_at", { ascending: false }),
    supabase.rpc("collection_owner_options"),
  ]);
  if (loadResult.error) throw loadResult.error;
  if (entriesResult.error) throw entriesResult.error;
  if (contactsResult.error) throw contactsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const load = loadResult.data as unknown as { id: string; load_number: string; load_rate: number; status: string; brokers: { company_name: string } | null; payments: Payment | Payment[] | null };
  const payment = relation(load.payments);
  if (!payment) throw new Error("Payment record unavailable.");
  const entries = (entriesResult.data ?? []) as Entry[];
  return { load, payment, entries, contacts: (contactsResult.data ?? []) as Contact[], owners: profilesResult.data ?? [], balance: receivableBalance(load.load_rate, entries as ReceivableEntry[]) };
}

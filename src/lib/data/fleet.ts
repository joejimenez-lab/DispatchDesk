import { notFound } from "next/navigation";
import { isMissingPostgrestRow } from "@/lib/data/not-found";
import { createClient } from "@/lib/supabase/server";
import { ilikeOr, searchTokens } from "@/lib/search";
import type { Database } from "@/types/database";

type UnitRow = Database["public"]["Tables"]["fleet_units"]["Row"];
type ServiceRow = Database["public"]["Tables"]["service_records"]["Row"];
type InspectionRow = Database["public"]["Tables"]["inspection_records"]["Row"];
type RepairRow = Database["public"]["Tables"]["repair_logs"]["Row"];
type ReminderRow = Database["public"]["Tables"]["maintenance_reminders"]["Row"];
export type BookkeepingLink = {
  id: string;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
  bookkeeping_expenses: { id: string; category: string; amount: number; line_type: string }[];
  bookkeeping_receipts: { id: string }[];
};
export type ServiceWithExpense = ServiceRow & { bookkeeping_expense_groups: BookkeepingLink[] };
export type InspectionWithExpense = InspectionRow & { bookkeeping_expense_groups: BookkeepingLink[] };
export type RepairWithExpense = RepairRow & { bookkeeping_expense_groups: BookkeepingLink[] };

const FLEET_SEARCH_COLUMNS = ["unit_number", "company"];

export async function getUnits(q?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("fleet_units")
    .select("*")
    .order("unit_type")
    .order("unit_number");
  for (const token of searchTokens(q)) {
    query = query.or(ilikeOr(FLEET_SEARCH_COLUMNS, token));
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UnitRow[];
}

export async function getFleetCompanies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fleet_units")
    .select("company")
    .not("company", "is", null)
    .order("company");

  if (error) throw error;

  const companies = (data ?? [])
    .map((row) => row.company?.trim())
    .filter((company): company is string => Boolean(company));

  return [...new Map(companies.map((company) => [company.toLocaleLowerCase(), company])).values()];
}

export async function getFleetTruckNumbers(company: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fleet_units")
    .select("unit_number")
    .eq("unit_type", "Truck")
    .eq("company", company)
    .order("unit_number");

  if (error) throw error;

  return (data ?? [])
    .map((unit) => unit.unit_number?.trim())
    .filter((unitNumber): unitNumber is string => Boolean(unitNumber));
}

export async function getUnit(unitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fleet_units")
    .select("*")
    .eq("id", unitId)
    .single();

  if (isMissingPostgrestRow(error) || (!error && !data)) notFound();
  if (error) throw error;
  return data as UnitRow;
}

export async function getUnitRecords(unitId: string) {
  const supabase = await createClient();
  const [service, inspections, repairs, reminders, financialLinks] = await Promise.all([
    supabase.from("service_records").select("*, bookkeeping_expense_groups(id, expense_date, vendor, notes, bookkeeping_expenses(id, category, amount, line_type), bookkeeping_receipts(id))").eq("unit_id", unitId).order("service_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("inspection_records").select("*, bookkeeping_expense_groups(id, expense_date, vendor, notes, bookkeeping_expenses(id, category, amount, line_type), bookkeeping_receipts(id))").eq("unit_id", unitId).order("inspection_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("repair_logs").select("*, bookkeeping_expense_groups(id, expense_date, vendor, notes, bookkeeping_expenses(id, category, amount, line_type), bookkeeping_receipts(id))").eq("unit_id", unitId).order("repair_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("maintenance_reminders").select("*").eq("unit_id", unitId).order("completed_at", { ascending: true, nullsFirst: true }).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("bookkeeping_expense_groups").select("id", { count: "exact", head: true }).eq("unit_id", unitId),
  ]);

  if (service.error) throw service.error;
  if (inspections.error) throw inspections.error;
  if (repairs.error) throw repairs.error;
  if (reminders.error) throw reminders.error;
  if (financialLinks.error) throw financialLinks.error;

  return {
    service: (service.data ?? []) as unknown as ServiceWithExpense[],
    inspections: (inspections.data ?? []) as unknown as InspectionWithExpense[],
    repairs: (repairs.data ?? []) as unknown as RepairWithExpense[],
    reminders: (reminders.data ?? []) as ReminderRow[],
    financialLinkCount: financialLinks.count ?? 0,
  };
}

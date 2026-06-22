import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ilikeOr, searchTokens } from "@/lib/search";
import type { Database } from "@/types/database";

type UnitRow = Database["public"]["Tables"]["fleet_units"]["Row"];
type ServiceRow = Database["public"]["Tables"]["service_records"]["Row"];
type InspectionRow = Database["public"]["Tables"]["inspection_records"]["Row"];
type RepairRow = Database["public"]["Tables"]["repair_logs"]["Row"];
type ReminderRow = Database["public"]["Tables"]["maintenance_reminders"]["Row"];

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

export async function getUnit(unitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fleet_units")
    .select("*")
    .eq("id", unitId)
    .single();

  if (error || !data) notFound();
  return data as UnitRow;
}

export async function getUnitRecords(unitId: string) {
  const supabase = await createClient();
  const [service, inspections, repairs, reminders] = await Promise.all([
    supabase.from("service_records").select("*").eq("unit_id", unitId).order("service_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("inspection_records").select("*").eq("unit_id", unitId).order("inspection_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("repair_logs").select("*").eq("unit_id", unitId).order("repair_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("maintenance_reminders").select("*").eq("unit_id", unitId).order("completed_at", { ascending: true, nullsFirst: true }).order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  if (service.error) throw service.error;
  if (inspections.error) throw inspections.error;
  if (repairs.error) throw repairs.error;
  if (reminders.error) throw reminders.error;

  return {
    service: (service.data ?? []) as ServiceRow[],
    inspections: (inspections.data ?? []) as InspectionRow[],
    repairs: (repairs.data ?? []) as RepairRow[],
    reminders: (reminders.data ?? []) as ReminderRow[],
  };
}

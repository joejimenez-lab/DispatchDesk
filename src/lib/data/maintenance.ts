import { notFound } from "next/navigation";
import { isMissingPostgrestRow } from "@/lib/data/not-found";
import { classifyMaintenanceReminder, sortMaintenanceAlerts, type MaintenanceAlert } from "@/lib/maintenance";
import { createAuthenticatedClient } from "@/lib/supabase/authenticated";
import type { Database } from "@/types/database";
import type { UnitType } from "@/types/database";

type ReminderRow = Database["public"]["Tables"]["maintenance_reminders"]["Row"];
type ReminderJoin = ReminderRow & {
  fleet_units: {
    id: string;
    unit_number: string;
    unit_type: UnitType;
    odometer: number | null;
    company: string | null;
  } | {
    id: string;
    unit_number: string;
    unit_type: UnitType;
    odometer: number | null;
    company: string | null;
  }[] | null;
};

export function mapMaintenanceAlerts(rows: unknown[], today?: string) {
  const alerts = rows.flatMap((value) => {
    const reminder = value as ReminderJoin;
    const unit = Array.isArray(reminder.fleet_units) ? reminder.fleet_units[0] : reminder.fleet_units;
    if (!unit) return [];
    const classification = classifyMaintenanceReminder(reminder, unit.odometer, today);
    return [{ ...reminder, unit, ...classification } satisfies MaintenanceAlert];
  });

  return sortMaintenanceAlerts(alerts);
}

export async function getMaintenanceAlerts(fleet?: string) {
  const { supabase } = await createAuthenticatedClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .select("*, fleet_units!inner(id, unit_number, unit_type, odometer, company)")
    .is("completed_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  const alerts = mapMaintenanceAlerts((data ?? []) as unknown[]);
  return fleet ? alerts.filter((alert) => alert.unit.company === fleet) : alerts;
}

export async function getMaintenanceReminder(reminderId: string) {
  const { supabase } = await createAuthenticatedClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .select("*, fleet_units!inner(id, unit_number, unit_type, odometer, company)")
    .eq("id", reminderId)
    .single();

  if (isMissingPostgrestRow(error) || (!error && !data)) notFound();
  if (error) throw error;
  return mapMaintenanceAlerts([data as unknown])[0];
}

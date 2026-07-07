import {
  encodeMaintenanceRecord,
  maintenanceRecordTypeLabel,
  type BookkeepingExportRow,
  type MaintenanceRecordTable,
} from "@/lib/bookkeeping";
import { createClient } from "@/lib/supabase/server";
import { expenseCategories, type Database, type ExpenseCategory, type UnitType } from "@/types/database";

type ExpenseRow = Database["public"]["Tables"]["bookkeeping_expenses"]["Row"];
type ReceiptRow = Database["public"]["Tables"]["bookkeeping_receipts"]["Row"];

type UnitLink = { id: string; unit_number: string; unit_type: UnitType; company?: string | null };
type LoadLink = { id: string; load_number: string; pickup_location: string; delivery_location: string };
type DriverLink = { id: string; name: string };
type ServiceLink = { id: string; service_date: string | null; description: string; fleet_units?: UnitLink | null };
type InspectionLink = { id: string; inspection_date: string | null; result: string | null; fleet_units?: UnitLink | null };
type RepairLink = { id: string; repair_date: string | null; description: string; log_type: string; fleet_units?: UnitLink | null };

export type BookkeepingExpense = ExpenseRow & {
  bookkeeping_receipts: ReceiptRow[];
  fleet_units: UnitLink | null;
  loads: LoadLink | null;
  drivers: DriverLink | null;
  service_records: ServiceLink | null;
  inspection_records: InspectionLink | null;
  repair_logs: RepairLink | null;
};

export type BookkeepingFilters = {
  from?: string;
  to?: string;
  category?: string;
  unit?: string;
  load?: string;
  driver?: string;
};

export type MaintenanceRecordOption = {
  value: string;
  label: string;
  table: MaintenanceRecordTable;
  id: string;
  unitId: string | null;
};

export type BookkeepingOptions = {
  units: UnitLink[];
  loads: LoadLink[];
  drivers: DriverLink[];
  maintenanceRecords: MaintenanceRecordOption[];
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: string | undefined) {
  return value && isoDatePattern.test(value) ? value : null;
}

function validUuid(value: string | undefined) {
  return value && uuidPattern.test(value) ? value : null;
}

export function normalizeExpenseCategory(value: string | undefined): ExpenseCategory | null {
  return expenseCategories.includes(value as ExpenseCategory) ? (value as ExpenseCategory) : null;
}

function unitLabel(unit: UnitLink | null | undefined) {
  return unit ? `${unit.unit_type} ${unit.unit_number}` : null;
}

function maintenanceRecordLabel(expense: BookkeepingExpense) {
  if (expense.service_records) {
    return `Service - ${expense.service_records.description}`;
  }
  if (expense.inspection_records) {
    return `Inspection - ${expense.inspection_records.result ?? "Inspection"}`;
  }
  if (expense.repair_logs) {
    return `${expense.repair_logs.log_type} - ${expense.repair_logs.description}`;
  }
  return null;
}

function optionLabel({
  table,
  unit,
  date,
  description,
}: {
  table: MaintenanceRecordTable;
  unit: UnitLink | null;
  date: string | null;
  description: string;
}) {
  return [
    maintenanceRecordTypeLabel(table),
    unitLabel(unit) ?? "Unknown unit",
    date ?? "No date",
    description,
  ].join(" - ");
}

export function bookkeepingExpenseToExportRow(expense: BookkeepingExpense): BookkeepingExportRow {
  return {
    expenseDate: expense.expense_date,
    category: expense.category,
    amount: Number(expense.amount),
    vendor: expense.vendor,
    unit: unitLabel(expense.fleet_units),
    loadNumber: expense.loads?.load_number ?? null,
    driver: expense.drivers?.name ?? null,
    maintenanceRecord: maintenanceRecordLabel(expense),
    receiptCount: expense.bookkeeping_receipts.length,
    receiptFiles: expense.bookkeeping_receipts.map((receipt) => receipt.file_name).join("; "),
    notes: expense.notes,
  };
}

export async function getBookkeepingExpenses(filters: BookkeepingFilters = {}) {
  const supabase = await createClient();
  const category = normalizeExpenseCategory(filters.category);
  const from = validDate(filters.from);
  const to = validDate(filters.to);
  const unit = validUuid(filters.unit);
  const load = validUuid(filters.load);
  const driver = validUuid(filters.driver);

  if ((filters.unit && !unit) || (filters.load && !load) || (filters.driver && !driver)) return [];

  let query = supabase
    .from("bookkeeping_expenses")
    .select(`
      *,
      bookkeeping_receipts(*),
      fleet_units(id, unit_number, unit_type, company),
      loads(id, load_number, pickup_location, delivery_location),
      drivers(id, name),
      service_records(id, service_date, description, fleet_units(id, unit_number, unit_type, company)),
      inspection_records(id, inspection_date, result, fleet_units(id, unit_number, unit_type, company)),
      repair_logs(id, repair_date, description, log_type, fleet_units(id, unit_number, unit_type, company))
    `)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);
  if (unit) query = query.eq("unit_id", unit);
  if (load) query = query.eq("load_id", load);
  if (driver) query = query.eq("driver_id", driver);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as BookkeepingExpense[];
}

export async function getBookkeepingOptions(): Promise<BookkeepingOptions> {
  const supabase = await createClient();
  const [units, loads, drivers, services, inspections, repairs] = await Promise.all([
    supabase.from("fleet_units").select("id, unit_number, unit_type, company").order("unit_type").order("unit_number"),
    supabase
      .from("loads")
      .select("id, load_number, pickup_location, delivery_location")
      .order("delivery_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("drivers").select("id, name").order("name"),
    supabase
      .from("service_records")
      .select("id, unit_id, service_date, description, created_at, fleet_units(id, unit_number, unit_type, company)")
      .order("service_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("inspection_records")
      .select("id, unit_id, inspection_date, result, created_at, fleet_units(id, unit_number, unit_type, company)")
      .order("inspection_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("repair_logs")
      .select("id, unit_id, repair_date, description, log_type, created_at, fleet_units(id, unit_number, unit_type, company)")
      .order("repair_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  for (const result of [units, loads, drivers, services, inspections, repairs]) {
    if (result.error) throw result.error;
  }

  const serviceOptions = ((services.data ?? []) as unknown as {
    id: string;
    unit_id: string | null;
    service_date: string | null;
    created_at: string;
    description: string;
    fleet_units: UnitLink | null;
  }[]).map((record) => ({
    value: encodeMaintenanceRecord({ table: "service_records", id: record.id }),
    label: optionLabel({
      table: "service_records",
      unit: record.fleet_units,
      date: record.service_date ?? record.created_at.slice(0, 10),
      description: record.description,
    }),
    table: "service_records" as const,
    id: record.id,
    unitId: record.unit_id,
  }));

  const inspectionOptions = ((inspections.data ?? []) as unknown as {
    id: string;
    unit_id: string | null;
    inspection_date: string | null;
    created_at: string;
    result: string | null;
    fleet_units: UnitLink | null;
  }[]).map((record) => ({
    value: encodeMaintenanceRecord({ table: "inspection_records", id: record.id }),
    label: optionLabel({
      table: "inspection_records",
      unit: record.fleet_units,
      date: record.inspection_date ?? record.created_at.slice(0, 10),
      description: record.result ?? "Inspection",
    }),
    table: "inspection_records" as const,
    id: record.id,
    unitId: record.unit_id,
  }));

  const repairOptions = ((repairs.data ?? []) as unknown as {
    id: string;
    unit_id: string | null;
    repair_date: string | null;
    created_at: string;
    description: string;
    log_type: string;
    fleet_units: UnitLink | null;
  }[]).map((record) => ({
    value: encodeMaintenanceRecord({ table: "repair_logs", id: record.id }),
    label: optionLabel({
      table: "repair_logs",
      unit: record.fleet_units,
      date: record.repair_date ?? record.created_at.slice(0, 10),
      description: `${record.log_type}: ${record.description}`,
    }),
    table: "repair_logs" as const,
    id: record.id,
    unitId: record.unit_id,
  }));

  return {
    units: (units.data ?? []) as UnitLink[],
    loads: (loads.data ?? []) as LoadLink[],
    drivers: (drivers.data ?? []) as DriverLink[],
    maintenanceRecords: [...serviceOptions, ...inspectionOptions, ...repairOptions],
  };
}

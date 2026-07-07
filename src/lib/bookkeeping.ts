import { csvRow } from "@/lib/csv";
import type { ExpenseCategory } from "@/types/database";

export const receiptAccept =
  "application/pdf,image/png,image/jpeg,image/heic,image/heif,.pdf,.png,.jpg,.jpeg,.heic,.heif";

export const maintenanceRecordTables = ["service_records", "inspection_records", "repair_logs"] as const;
export type MaintenanceRecordTable = (typeof maintenanceRecordTables)[number];

export type MaintenanceRecordLink = {
  table: MaintenanceRecordTable;
  id: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeMaintenanceRecord(link: MaintenanceRecordLink) {
  return `${link.table}:${link.id}`;
}

export function parseMaintenanceRecord(value: string | null): MaintenanceRecordLink | null {
  if (!value) return null;
  const [table, id] = value.split(":");
  if (!maintenanceRecordTables.includes(table as MaintenanceRecordTable) || !uuidPattern.test(id ?? "")) {
    throw new Error("Choose a valid maintenance record.");
  }
  return { table: table as MaintenanceRecordTable, id };
}

export function maintenanceRecordTypeLabel(table: MaintenanceRecordTable) {
  if (table === "service_records") return "Service";
  if (table === "inspection_records") return "Inspection";
  return "Repair";
}

export function expenseCategoryTone(category: ExpenseCategory) {
  if (category === "Fuel") return "border-blue-200 bg-blue-50 text-blue-800";
  if (category === "Maintenance" || category === "Parts") return "border-amber-200 bg-amber-50 text-amber-900";
  if (category === "Insurance" || category === "Permits") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (category === "Tolls" || category === "Parking") return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

export type BookkeepingExportRow = {
  expenseDate: string;
  category: string;
  amount: number;
  vendor: string | null;
  unit: string | null;
  loadNumber: string | null;
  driver: string | null;
  maintenanceRecord: string | null;
  receiptCount: number;
  receiptFiles: string;
  notes: string | null;
};

export function bookkeepingCsv(rows: BookkeepingExportRow[]) {
  return [
    csvRow([
      "Date",
      "Category",
      "Amount",
      "Vendor",
      "Truck / Trailer",
      "Load",
      "Driver",
      "Maintenance Record",
      "Receipt Count",
      "Receipt Files",
      "Notes",
    ]),
    ...rows.map((row) => csvRow([
      row.expenseDate,
      row.category,
      row.amount.toFixed(2),
      row.vendor,
      row.unit,
      row.loadNumber,
      row.driver,
      row.maintenanceRecord,
      row.receiptCount,
      row.receiptFiles,
      row.notes,
    ])),
  ].join("\n");
}

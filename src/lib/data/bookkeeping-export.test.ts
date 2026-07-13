import { describe, expect, it } from "vitest";
import { bookkeepingExpenseToExportRows, type BookkeepingExpense } from "./bookkeeping";

const transaction = {
  id: "group-1",
  expense_date: "2026-07-13",
  vendor: "Quality Shop",
  notes: "Oil and filters",
  source_type: "maintenance",
  bookkeeping_expenses: [
    { id: "line-1", category: "Maintenance", amount: 180, line_type: "labor", group_id: "group-1", created_at: "", updated_at: "" },
    { id: "line-2", category: "Parts", amount: 70, line_type: "parts", group_id: "group-1", created_at: "", updated_at: "" },
  ],
  bookkeeping_receipts: [{ id: "receipt-1", file_name: "receipt.pdf", storage_path: "group-1/receipt.pdf", content_type: "application/pdf", file_size: 100, group_id: "group-1", created_at: "" }],
  fleet_units: { id: "unit-1", unit_number: "T-1", unit_type: "Truck", company: "Fleet A" },
  loads: null,
  drivers: null,
  service_records: { id: "service-1", service_date: "2026-07-13", description: "Oil change", fleet_units: null },
  inspection_records: null,
  repair_logs: null,
  ifta_fuel_purchases: null,
  amount: 250,
  category: "Maintenance",
} as unknown as BookkeepingExpense;

describe("Bookkeeping transaction exports", () => {
  it("exports labor and parts once while counting their shared receipt once", () => {
    const rows = bookkeepingExpenseToExportRows(transaction);

    expect(rows.map((row) => [row.category, row.amount, row.lineType])).toEqual([
      ["Maintenance", 180, "labor"],
      ["Parts", 70, "parts"],
    ]);
    expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(250);
    expect(rows.map((row) => row.receiptCount)).toEqual([1, 0]);
  });

  it("keeps category-filtered exports accurate without losing the shared receipt", () => {
    const rows = bookkeepingExpenseToExportRows(transaction, "Parts");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "Parts", amount: 70, receiptCount: 1, source: "maintenance" });
  });
});

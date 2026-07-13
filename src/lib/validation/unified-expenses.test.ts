import { describe, expect, it } from "vitest";
import {
  bookkeepingExpenseSchema,
  iftaFuelPurchaseSchema,
  maintenanceCompletionSchema,
} from "./schemas";

describe("unified operational expense validation", () => {
  it("accepts a zero-cost maintenance completion without creating a breakdown", () => {
    const result = maintenanceCompletionSchema.parse({
      completed_date: "2026-07-13",
      odometer: "125000",
      cost_mode: "total",
      total_cost: "0",
      labor_cost: "0",
      parts_cost: "0",
      vendor: "",
      notes: "Inspection only",
    });

    expect(result.total_cost).toBe(0);
    expect(result.vendor).toBeNull();
  });

  it("accepts labor and parts and rejects an empty breakdown", () => {
    const valid = maintenanceCompletionSchema.safeParse({
      completed_date: "2026-07-13",
      odometer: "",
      cost_mode: "breakdown",
      total_cost: "0",
      labor_cost: "180.50",
      parts_cost: "70.25",
      vendor: "Quality Shop",
      notes: "",
    });
    const empty = maintenanceCompletionSchema.safeParse({
      completed_date: "2026-07-13",
      odometer: "",
      cost_mode: "breakdown",
      total_cost: "0",
      labor_cost: "0",
      parts_cost: "0",
      vendor: "",
      notes: "",
    });

    expect(valid.success && valid.data.labor_cost + valid.data.parts_cost).toBe(250.75);
    expect(empty.success).toBe(false);
  });

  it("requires IFTA fuel spending to use a fleet UUID and positive values", () => {
    const base = {
      unit_id: "47000000-0000-4000-8000-000000000001",
      purchase_date: "2026-07-13",
      city: "Reno",
      state: "NV",
      gallons: "100",
      amount_paid: "425",
      vendor: "Fuel Stop",
      notes: "",
    };

    expect(iftaFuelPurchaseSchema.safeParse(base).success).toBe(true);
    expect(iftaFuelPurchaseSchema.safeParse({ ...base, unit_id: "TRUCK-1" }).success).toBe(false);
    expect(iftaFuelPurchaseSchema.safeParse({ ...base, amount_paid: "0" }).success).toBe(false);
  });

  it("validates Bookkeeping labor and parts edits", () => {
    const result = bookkeepingExpenseSchema.parse({
      expense_date: "2026-07-13",
      category: "Maintenance",
      amount: "250",
      cost_mode: "breakdown",
      labor_cost: "180",
      parts_cost: "70",
      vendor: "Quality Shop",
      unit_id: "",
      load_id: "",
      driver_id: "",
      maintenance_record: "",
      notes: "",
    });

    expect(result.labor_cost + result.parts_cost).toBe(result.amount);
  });
});

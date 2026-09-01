import { describe, expect, it } from "vitest";
import {
  BOOKKEEPING_EXPENSE_SELECT,
  bookkeepingExpenseMatchesFleet,
  resolveBookkeepingFleet,
  type BookkeepingExpense,
} from "./bookkeeping";

function expense(patch: Partial<BookkeepingExpense>): BookkeepingExpense {
  return {
    fleet_units: null,
    loads: null,
    drivers: { id: "driver", name: "Shared driver", truck_number: "RC-9" },
    service_records: null,
    inspection_records: null,
    repair_logs: null,
    ifta_fuel_purchases: null,
    fleetCompany: null,
    fleetConflict: false,
    ...patch,
  } as BookkeepingExpense;
}

describe("bookkeeping fleet classification", () => {
  it("pins fuel purchase embedding to the bookkeeping-owned relationship", () => {
    expect(BOOKKEEPING_EXPENSE_SELECT).toContain(
      "ifta_fuel_purchases!bookkeeping_expense_groups_ifta_fuel_purchase_id_fkey(",
    );
    expect(BOOKKEEPING_EXPENSE_SELECT).not.toMatch(/\n\s*ifta_fuel_purchases\(/);
  });

  it("uses a load snapshot instead of the driver's current truck", () => {
    const row = expense({ loads: { id: "load", load_number: "L1", pickup_location: "A", delivery_location: "B", fleet_company: "RD" } });
    const classification = resolveBookkeepingFleet(row);
    expect(classification).toEqual({ fleetCompany: "RD", fleetConflict: false });
    expect(bookkeepingExpenseMatchesFleet({ ...row, ...classification }, { kind: "fleet", company: "RC" })).toBe(false);
  });

  it("leaves conflicting durable links unassigned for review", () => {
    const row = expense({
      fleet_units: { id: "unit", unit_number: "1", unit_type: "Truck", company: "RD" },
      loads: { id: "load", load_number: "L2", pickup_location: "A", delivery_location: "B", fleet_company: "RC" },
    });
    const classification = resolveBookkeepingFleet(row);
    expect(classification).toEqual({ fleetCompany: null, fleetConflict: true });
    expect(bookkeepingExpenseMatchesFleet({ ...row, ...classification }, { kind: "unassigned" })).toBe(true);
  });
});

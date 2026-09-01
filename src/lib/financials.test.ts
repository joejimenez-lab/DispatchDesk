import { describe, expect, it } from "vitest";
import {
  clientCollected,
  clientOutstanding,
  deductionsTotal,
  factoringAmount,
  factoringDeductionAmount,
  addFinancialCompletenessTotals,
  financialCompleteness,
  isClientPaymentPaid,
  matchesFinancialCompleteness,
  profitForLoad,
  roundCents,
  totalDeductionsForLoad,
} from "./financials";

describe("load financials", () => {
  it("distinguishes unknown costs from confirmed zero-dollar costs", () => {
    expect(financialCompleteness({
      driver_pay_known: true,
      dispatcher_fee_known: true,
      fuel_cost_known: false,
    })).toEqual({ complete: false, missingFields: ["fuel_cost"], missingLabels: ["Fuel cost"] });
    expect(matchesFinancialCompleteness({ driver_pay_known: true, dispatcher_fee_known: true, fuel_cost_known: true }, "complete")).toBe(true);
    expect(matchesFinancialCompleteness({ driver_pay_known: true, dispatcher_fee_known: true, fuel_cost_known: false }, "incomplete")).toBe(true);
  });

  it("totals revenue and provisional margin affected by incomplete inputs", () => {
    const totals = addFinancialCompletenessTotals(
      { completeLoadCount: 0, incompleteLoadCount: 1, incompleteRevenueTotal: 1000, incompleteProvisionalMarginTotal: 350 },
      { load_rate: 800, driver_pay_known: true, dispatcher_fee_known: false, fuel_cost_known: true },
      280,
    );
    expect(totals).toEqual({ completeLoadCount: 0, incompleteLoadCount: 2, incompleteRevenueTotal: 1800, incompleteProvisionalMarginTotal: 630 });
  });

  it("preserves the existing profit result when a load has no deductions", () => {
    expect(profitForLoad({
      load_rate: 1_000,
      driver_pay: 500,
      dispatcher_fee: 100,
      fuel_cost: 50,
      factoring_amount: 0,
      load_deductions: [],
    })).toBe(350);
  });

  it("rounds percentage deductions consistently to currency precision", () => {
    expect(factoringAmount(1_250.55, 3)).toBe(37.52);
    expect(factoringAmount(100.5, 1)).toBe(1.01);
    expect(roundCents(1.005)).toBe(1.01);
  });

  it("uses a fixed factoring amount without changing it when the load rate changes", () => {
    expect(factoringDeductionAmount(1_000, "amount", 0, 85.755)).toBe(85.76);
    expect(factoringDeductionAmount(2_000, "amount", 0, 85.755)).toBe(85.76);
    expect(factoringDeductionAmount(2_000, "percentage", 3, 0)).toBe(60);
  });

  it("totals fixed and combined deductions", () => {
    const load = {
      factoring_amount: 30,
      load_deductions: [{ amount: 75 }, { amount: 24.5 }],
    };

    expect(deductionsTotal(load.load_deductions)).toBe(99.5);
    expect(totalDeductionsForLoad(load)).toBe(129.5);
    expect(profitForLoad({
      load_rate: 1_000,
      driver_pay: 500,
      dispatcher_fee: 100,
      fuel_cost: 50,
      ...load,
    })).toBe(220.5);
  });

  it("subtracts each deduction exactly once after edits and removal", () => {
    const base = {
      load_rate: 1_000,
      driver_pay: 500,
      dispatcher_fee: 100,
      fuel_cost: 50,
      factoring_amount: 25,
    };

    expect(profitForLoad({ ...base, load_deductions: [{ amount: 75 }] })).toBe(250);
    expect(profitForLoad({ ...base, load_deductions: [{ amount: 30 }] })).toBe(295);
    expect(profitForLoad({ ...base, load_deductions: [] })).toBe(325);
  });

  it("keeps client collection and outstanding balances based on the full load rate", () => {
    const payment = { client_paid: false, client_amount_received: 250 };

    expect(clientCollected(1_000, payment)).toBe(250);
    expect(clientOutstanding(1_000, payment)).toBe(750);
    expect(isClientPaymentPaid(1_000, payment)).toBe(false);
    expect(clientCollected(1_000, { client_paid: true, client_amount_received: 0 })).toBe(1_000);
  });
});

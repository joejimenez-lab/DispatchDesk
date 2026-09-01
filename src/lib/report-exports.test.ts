import { describe, expect, it } from "vitest";
import { weeklyFinancialCsv, weeklyPayrollCsv, yearlyFinancialCsv } from "./report-exports";
import type { WeeklyDriverFinancialSummary } from "./data/weekly-financials";

const summaries: WeeklyDriverFinancialSummary[] = [
  {
    key: "2026-01-05:a",
    weekStart: "2026-01-05",
    weekEnd: "2026-01-11",
    driverId: "a",
    driverName: "Alex",
    loadCount: 1,
    loadRateTotal: 1000,
    driverPayTotal: 500,
    dispatcherFeeTotal: 100,
    fuelCostTotal: 150,
    factoringTotal: 30,
    otherDeductionTotal: 20,
    totalDeductionsTotal: 50,
    estimatedProfitTotal: 200,
    loads: [{ id: "1", loadNumber: "L1", status: "Delivered", postDeliveryStatus: "Closed", date: "2026-01-06", isRoundTrip: false, returnLocation: null, roundTripDetails: null, loadRate: 1000, driverPay: 500, dispatcherFee: 100, fuelCost: 150, factoringMode: "percentage", factoringPercent: 3, factoringFixedAmount: 0, factoringAmount: 30, otherDeductions: [{ label: "Lumper", amount: 20 }], otherDeductionTotal: 20, totalDeductions: 50, estimatedProfit: 200 }],
  },
  {
    key: "2026-01-05:b",
    weekStart: "2026-01-05",
    weekEnd: "2026-01-11",
    driverId: "b",
    driverName: "Blair",
    loadCount: 1,
    loadRateTotal: 800,
    driverPayTotal: 400,
    dispatcherFeeTotal: 80,
    fuelCostTotal: 120,
    factoringTotal: 24,
    otherDeductionTotal: 10,
    totalDeductionsTotal: 34,
    estimatedProfitTotal: 166,
    loads: [{ id: "2", loadNumber: "L2", status: "Delivered", postDeliveryStatus: "Invoiced", date: "2026-01-07", isRoundTrip: false, returnLocation: null, roundTripDetails: null, loadRate: 800, driverPay: 400, dispatcherFee: 80, fuelCost: 120, factoringMode: "amount", factoringPercent: 0, factoringFixedAmount: 24, factoringAmount: 24, otherDeductions: [{ label: "Scale", amount: 10 }], otherDeductionTotal: 10, totalDeductions: 34, estimatedProfit: 166 }],
  },
];

describe("report exports", () => {
  it("creates one payroll row per driver and week", () => {
    expect(weeklyPayrollCsv(summaries).split("\n")).toHaveLength(3);
    expect(weeklyPayrollCsv(summaries)).toContain("Alex,1,500");
  });

  it("combines drivers into one weekly financial row", () => {
    expect(weeklyFinancialCsv(summaries).split("\n")).toHaveLength(2);
    expect(weeklyFinancialCsv(summaries)).toContain("2026-01-05,2026-01-11,2,1800,900,180,270,54,30,84,366");
  });

  it("creates annual totals from individual loads", () => {
    expect(yearlyFinancialCsv(summaries)).toContain("2026,2,1800,900,180,270,54,30,84,366");
  });
});

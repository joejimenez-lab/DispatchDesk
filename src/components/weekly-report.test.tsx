import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WeeklyDriverFinancialSummary } from "@/lib/data/weekly-financials";
import { SummaryTotals } from "./weekly-report";

const summary: WeeklyDriverFinancialSummary = {
  key: "2026-08-31-driver-1",
  weekStart: "2026-08-31",
  weekEnd: "2026-09-06",
  driverId: "driver-1",
  driverName: "Driver One",
  fleetCompany: "West",
  loadCount: 2,
  loadRateTotal: 2500,
  driverPayTotal: 1000,
  dispatcherFeeTotal: 200,
  fuelCostTotal: 300,
  factoringTotal: 0,
  otherDeductionTotal: 0,
  totalDeductionsTotal: 1500,
  estimatedProfitTotal: 600,
  completeLoadCount: 1,
  incompleteLoadCount: 1,
  incompleteRevenueTotal: 900,
  incompleteProvisionalMarginTotal: 300,
  loads: [],
};

describe("SummaryTotals", () => {
  it("keeps the classic summary cards with a compact completeness note", () => {
    const html = renderToStaticMarkup(<SummaryTotals summaries={[summary]} />);

    expect(html).toContain("Estimated Profit");
    expect(html).toContain("Estimated profit excludes 1 load with incomplete cost inputs");
    expect(html).not.toContain("Complete-load profit");
    expect(html).not.toContain('role="alert"');
  });
});

import { csvRow } from "./csv";
import type { WeeklyDriverFinancialSummary } from "./data/weekly-financials";
import { roundCents } from "./financials";

export type BillingRow = {
  fleet: string;
  loadNumber: string;
  loadDate: string;
  broker: string | null;
  status: string;
  postDeliveryStatus: string | null;
  loadRate: number;
  invoiceSent: boolean;
  invoiceSentDate: string | null;
  clientPaid: boolean;
  amountReceived: number;
  dateReceived: string | null;
  outstanding: number;
};

export type YearlyFinancialRow = {
  year: string;
  fleet: string;
  loadCount: number;
  revenue: number;
  driverPay: number;
  dispatcherFees: number;
  fuelCost: number;
  factoring: number;
  otherDeductions: number;
  totalDeductions: number;
  profit: number;
};

export type MaintenanceExportRow = {
  unitNumber: string;
  unitType: string;
  company: string | null;
  recordType: string;
  date: string | null;
  odometer: number | null;
  description: string;
  result: string | null;
  cost: number | null;
  status: string | null;
  notes: string | null;
};

function csv(headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  return [csvRow(headers), ...rows.map(csvRow)].join("\n");
}

export function weeklyPayrollCsv(summaries: WeeklyDriverFinancialSummary[]) {
  return csv(
    ["Fleet", "Week Start", "Week End", "Driver", "Load Count", "Gross Driver Pay"],
    summaries.map((summary) => [
      summary.fleetCompany ?? "Unassigned", summary.weekStart,
      summary.weekEnd,
      summary.driverName,
      summary.loadCount,
      summary.driverPayTotal,
    ]),
  );
}

export function weeklyFinancialCsv(summaries: WeeklyDriverFinancialSummary[]) {
  const weeks = new Map<string, Omit<WeeklyDriverFinancialSummary, "key" | "driverId" | "driverName" | "loads">>();

  for (const summary of summaries) {
    const mapKey = `${summary.weekStart}:${summary.fleetCompany ?? "unassigned"}`;
    const week = weeks.get(mapKey) ?? {
      weekStart: summary.weekStart,
      weekEnd: summary.weekEnd,
      fleetCompany: summary.fleetCompany,
      loadCount: 0,
      loadRateTotal: 0,
      driverPayTotal: 0,
      dispatcherFeeTotal: 0,
      fuelCostTotal: 0,
      factoringTotal: 0,
      otherDeductionTotal: 0,
      totalDeductionsTotal: 0,
      estimatedProfitTotal: 0,
    };
    week.loadCount += summary.loadCount;
    week.loadRateTotal = roundCents(week.loadRateTotal + summary.loadRateTotal);
    week.driverPayTotal = roundCents(week.driverPayTotal + summary.driverPayTotal);
    week.dispatcherFeeTotal = roundCents(week.dispatcherFeeTotal + summary.dispatcherFeeTotal);
    week.fuelCostTotal = roundCents(week.fuelCostTotal + summary.fuelCostTotal);
    week.factoringTotal = roundCents(week.factoringTotal + summary.factoringTotal);
    week.otherDeductionTotal = roundCents(week.otherDeductionTotal + summary.otherDeductionTotal);
    week.totalDeductionsTotal = roundCents(week.totalDeductionsTotal + summary.totalDeductionsTotal);
    week.estimatedProfitTotal = roundCents(week.estimatedProfitTotal + summary.estimatedProfitTotal);
    weeks.set(mapKey, week);
  }

  return csv(
    ["Fleet", "Week Start", "Week End", "Load Count", "Revenue", "Driver Pay", "Dispatcher Fees", "Fuel Cost", "Factoring", "Other Deductions", "Total Deductions", "Estimated Profit"],
    [...weeks.values()].map((week) => [
      week.fleetCompany ?? "Unassigned", week.weekStart,
      week.weekEnd,
      week.loadCount,
      week.loadRateTotal,
      week.driverPayTotal,
      week.dispatcherFeeTotal,
      week.fuelCostTotal,
      week.factoringTotal,
      week.otherDeductionTotal,
      week.totalDeductionsTotal,
      week.estimatedProfitTotal,
    ]),
  );
}

export function yearlyFinancialRows(summaries: WeeklyDriverFinancialSummary[]): YearlyFinancialRow[] {
  const years = new Map<string, { year: string; fleet: string; loadCount: number; revenue: number; driverPay: number; dispatcherFees: number; fuelCost: number; factoring: number; otherDeductions: number; totalDeductions: number; profit: number }>();

  for (const summary of summaries) {
    for (const load of summary.loads) {
      const year = load.date.slice(0, 4);
      const fleet = load.fleetCompany ?? "Unassigned";
      const mapKey = `${year}:${fleet}`;
      const total = years.get(mapKey) ?? { year, fleet, loadCount: 0, revenue: 0, driverPay: 0, dispatcherFees: 0, fuelCost: 0, factoring: 0, otherDeductions: 0, totalDeductions: 0, profit: 0 };
      total.loadCount += 1;
      total.revenue = roundCents(total.revenue + load.loadRate);
      total.driverPay = roundCents(total.driverPay + load.driverPay);
      total.dispatcherFees = roundCents(total.dispatcherFees + load.dispatcherFee);
      total.fuelCost = roundCents(total.fuelCost + load.fuelCost);
      total.factoring = roundCents(total.factoring + load.factoringAmount);
      total.otherDeductions = roundCents(total.otherDeductions + load.otherDeductionTotal);
      total.totalDeductions = roundCents(total.totalDeductions + load.totalDeductions);
      total.profit = roundCents(total.profit + load.estimatedProfit);
      years.set(mapKey, total);
    }
  }

  return [...years.values()].sort((a, b) => b.year.localeCompare(a.year) || a.fleet.localeCompare(b.fleet));
}

export function yearlyFinancialCsv(summaries: WeeklyDriverFinancialSummary[]) {
  return csv(
    ["Fleet", "Year", "Load Count", "Revenue", "Driver Pay", "Dispatcher Fees", "Fuel Cost", "Factoring", "Other Deductions", "Total Deductions", "Estimated Profit"],
    yearlyFinancialRows(summaries).map((row) => [row.fleet, row.year, row.loadCount, row.revenue, row.driverPay, row.dispatcherFees, row.fuelCost, row.factoring, row.otherDeductions, row.totalDeductions, row.profit]),
  );
}

export function clientBillingCsv(rows: BillingRow[]) {
  return csv(
    ["Fleet", "Load Number", "Load Date", "Client", "Operational Status", "Post-delivery Stage", "Invoice Amount", "Invoice Sent", "Invoice Sent Date", "Client Paid", "Amount Received", "Date Received", "Outstanding"],
    rows.map((row) => [
      row.fleet, row.loadNumber,
      row.loadDate,
      row.broker,
      row.status,
      row.postDeliveryStatus,
      row.loadRate,
      row.invoiceSent,
      row.invoiceSentDate,
      row.clientPaid,
      row.amountReceived,
      row.dateReceived,
      row.outstanding,
    ]),
  );
}

export function maintenanceCsv(rows: MaintenanceExportRow[]) {
  return csv(
    ["Unit", "Unit Type", "Fleet", "Record Type", "Date", "Odometer", "Description", "Result", "Cost", "Status", "Notes"],
    rows.map((row) => [
      row.unitNumber,
      row.unitType,
      row.company ?? "Unassigned",
      row.recordType,
      row.date,
      row.odometer,
      row.description,
      row.result,
      row.cost,
      row.status,
      row.notes,
    ]),
  );
}

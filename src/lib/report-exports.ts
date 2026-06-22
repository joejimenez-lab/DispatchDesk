import { csvRow } from "./csv";
import type { WeeklyDriverFinancialSummary } from "./data/weekly-financials";

type BillingRow = {
  loadNumber: string;
  loadDate: string;
  broker: string | null;
  status: string;
  loadRate: number;
  invoiceSent: boolean;
  invoiceSentDate: string | null;
  clientPaid: boolean;
  amountReceived: number;
  dateReceived: string | null;
  outstanding: number;
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
    ["Week Start", "Week End", "Driver", "Load Count", "Gross Driver Pay"],
    summaries.map((summary) => [
      summary.weekStart,
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
    const week = weeks.get(summary.weekStart) ?? {
      weekStart: summary.weekStart,
      weekEnd: summary.weekEnd,
      loadCount: 0,
      loadRateTotal: 0,
      driverPayTotal: 0,
      dispatcherFeeTotal: 0,
      fuelCostTotal: 0,
      estimatedProfitTotal: 0,
    };
    week.loadCount += summary.loadCount;
    week.loadRateTotal += summary.loadRateTotal;
    week.driverPayTotal += summary.driverPayTotal;
    week.dispatcherFeeTotal += summary.dispatcherFeeTotal;
    week.fuelCostTotal += summary.fuelCostTotal;
    week.estimatedProfitTotal += summary.estimatedProfitTotal;
    weeks.set(summary.weekStart, week);
  }

  return csv(
    ["Week Start", "Week End", "Load Count", "Revenue", "Driver Pay", "Dispatcher Fees", "Fuel Cost", "Estimated Profit"],
    [...weeks.values()].map((week) => [
      week.weekStart,
      week.weekEnd,
      week.loadCount,
      week.loadRateTotal,
      week.driverPayTotal,
      week.dispatcherFeeTotal,
      week.fuelCostTotal,
      week.estimatedProfitTotal,
    ]),
  );
}

export function yearlyFinancialCsv(summaries: WeeklyDriverFinancialSummary[]) {
  const years = new Map<string, { loadCount: number; revenue: number; driverPay: number; dispatcherFees: number; fuelCost: number; profit: number }>();

  for (const summary of summaries) {
    for (const load of summary.loads) {
      const year = load.date.slice(0, 4);
      const total = years.get(year) ?? { loadCount: 0, revenue: 0, driverPay: 0, dispatcherFees: 0, fuelCost: 0, profit: 0 };
      total.loadCount += 1;
      total.revenue += load.loadRate;
      total.driverPay += load.driverPay;
      total.dispatcherFees += load.dispatcherFee;
      total.fuelCost += load.fuelCost;
      total.profit += load.estimatedProfit;
      years.set(year, total);
    }
  }

  return csv(
    ["Year", "Load Count", "Revenue", "Driver Pay", "Dispatcher Fees", "Fuel Cost", "Estimated Profit"],
    [...years.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, total]) => [year, total.loadCount, total.revenue, total.driverPay, total.dispatcherFees, total.fuelCost, total.profit]),
  );
}

export function clientBillingCsv(rows: BillingRow[]) {
  return csv(
    ["Load Number", "Load Date", "Client", "Status", "Invoice Amount", "Invoice Sent", "Invoice Sent Date", "Client Paid", "Amount Received", "Date Received", "Outstanding"],
    rows.map((row) => [
      row.loadNumber,
      row.loadDate,
      row.broker,
      row.status,
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
    ["Unit", "Unit Type", "Company", "Record Type", "Date", "Odometer", "Description", "Result", "Cost", "Status", "Notes"],
    rows.map((row) => [
      row.unitNumber,
      row.unitType,
      row.company,
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

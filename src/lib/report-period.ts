import type { WeeklyFinancialPeriod } from "@/lib/data/weekly-financials";

export const REPORT_PERIODS: { value: WeeklyFinancialPeriod; label: string }[] = [
  { value: "this", label: "This week" },
  { value: "last", label: "Last week" },
  { value: "all", label: "All weeks" },
  { value: "custom", label: "Custom range" },
];

export function normalizeReportPeriod(value: string | undefined): WeeklyFinancialPeriod {
  return REPORT_PERIODS.some((period) => period.value === value) ? value as WeeklyFinancialPeriod : "this";
}

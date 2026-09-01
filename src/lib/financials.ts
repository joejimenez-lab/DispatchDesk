type ClientPayment = {
  client_paid: boolean;
  client_amount_received: number | null;
} | null | undefined;

type DeductionAmount = { amount: number };

export const financialCostFields = ["driver_pay", "dispatcher_fee", "fuel_cost"] as const;
export type FinancialCostField = (typeof financialCostFields)[number];
export type FinancialCompletenessFilter = "all" | "complete" | "incomplete";

export const financialCostLabels: Record<FinancialCostField, string> = {
  driver_pay: "Driver pay",
  dispatcher_fee: "Dispatcher fee",
  fuel_cost: "Fuel cost",
};

export type FinancialCompletenessInput = {
  driver_pay_known: boolean;
  dispatcher_fee_known: boolean;
  fuel_cost_known: boolean;
};

export function financialCompleteness(load: FinancialCompletenessInput) {
  const missingFields = financialCostFields.filter((field) => !load[`${field}_known`]);
  return {
    complete: missingFields.length === 0,
    missingFields,
    missingLabels: missingFields.map((field) => financialCostLabels[field]),
  };
}

export function matchesFinancialCompleteness(
  load: FinancialCompletenessInput,
  filter: FinancialCompletenessFilter = "all",
) {
  if (filter === "all") return true;
  return financialCompleteness(load).complete === (filter === "complete");
}

export type FinancialCompletenessTotals = {
  completeLoadCount: number;
  incompleteLoadCount: number;
  incompleteRevenueTotal: number;
  incompleteProvisionalMarginTotal: number;
};

export function addFinancialCompletenessTotals(
  totals: FinancialCompletenessTotals,
  load: FinancialCompletenessInput & { load_rate: number },
  provisionalMargin: number,
) {
  if (financialCompleteness(load).complete) {
    return { ...totals, completeLoadCount: totals.completeLoadCount + 1 };
  }
  return {
    ...totals,
    incompleteLoadCount: totals.incompleteLoadCount + 1,
    incompleteRevenueTotal: roundCents(totals.incompleteRevenueTotal + Number(load.load_rate)),
    incompleteProvisionalMarginTotal: roundCents(totals.incompleteProvisionalMarginTotal + provisionalMargin),
  };
}

export const factoringModes = ["percentage", "amount"] as const;
export type FactoringMode = (typeof factoringModes)[number];

export function roundCents(value: number) {
  return Math.round(Number((Number(value) * 100).toFixed(6))) / 100;
}

export function factoringAmount(loadRate: number, factoringPercent: number) {
  return roundCents((Number(loadRate) * Number(factoringPercent)) / 100);
}

export function factoringDeductionAmount(
  loadRate: number,
  mode: FactoringMode,
  factoringPercent: number,
  fixedAmount: number,
) {
  return mode === "amount" ? roundCents(Number(fixedAmount)) : factoringAmount(loadRate, factoringPercent);
}

export function deductionsTotal(deductions: readonly DeductionAmount[]) {
  return roundCents(deductions.reduce((total, deduction) => total + Number(deduction.amount), 0));
}

export function totalDeductionsForLoad(load: {
  factoring_amount: number;
  load_deductions: readonly DeductionAmount[];
}) {
  return roundCents(Number(load.factoring_amount) + deductionsTotal(load.load_deductions));
}

export function profitForLoad(load: {
  load_rate: number;
  driver_pay: number;
  dispatcher_fee: number;
  fuel_cost: number;
  factoring_amount: number;
  load_deductions: readonly DeductionAmount[];
}) {
  return roundCents(
    Number(load.load_rate)
      - Number(load.driver_pay)
      - Number(load.dispatcher_fee)
      - Number(load.fuel_cost)
      - totalDeductionsForLoad(load),
  );
}

export function clientCollected(loadRate: number, payment: ClientPayment) {
  const rate = Number(loadRate);
  const received = Number(payment?.client_amount_received ?? 0);

  if (payment?.client_paid && received <= 0) return rate;
  return Math.min(Math.max(received, 0), rate);
}

export function clientOutstanding(loadRate: number, payment: ClientPayment) {
  return Math.max(Number(loadRate) - clientCollected(loadRate, payment), 0);
}

export function isClientPaymentPaid(loadRate: number, payment: ClientPayment) {
  return Boolean(payment?.client_paid) || clientOutstanding(loadRate, payment) <= 0;
}

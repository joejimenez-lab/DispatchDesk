type ClientPayment = {
  client_paid: boolean;
  client_amount_received: number | null;
} | null | undefined;

type DeductionAmount = { amount: number };

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

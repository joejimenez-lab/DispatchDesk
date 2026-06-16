type ClientPayment = {
  client_paid: boolean;
  client_amount_received: number | null;
} | null | undefined;

export function profitForLoad(load: {
  load_rate: number;
  driver_pay: number;
  dispatcher_fee: number;
  fuel_cost: number;
}) {
  return Number(load.load_rate) - Number(load.driver_pay) - Number(load.dispatcher_fee) - Number(load.fuel_cost);
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

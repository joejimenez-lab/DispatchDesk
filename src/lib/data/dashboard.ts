import { createClient } from "@/lib/supabase/server";

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const { data: loads, error } = await supabase
    .from("loads")
    .select("status, load_rate, driver_pay, dispatcher_fee, payments(client_paid, driver_paid, dispatcher_paid)");

  if (error) throw error;

  return ((loads ?? []) as unknown as {
    status: string;
    load_rate: number;
    driver_pay: number;
    dispatcher_fee: number;
    payments: { client_paid: boolean; driver_paid: boolean; dispatcher_paid: boolean } | { client_paid: boolean; driver_paid: boolean; dispatcher_paid: boolean }[] | null;
  }[]).reduce(
    (metrics, load) => {
      const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
      const active = !["Closed", "Cancelled"].includes(load.status);
      const delivered = ["Delivered", "POD Received", "Invoiced", "Client Paid", "Driver Paid", "Dispatcher Paid", "Closed"].includes(load.status);

      if (active) metrics.activeLoads += 1;
      if (delivered) metrics.deliveredLoads += 1;
      if (load.status === "Closed") metrics.closedLoads += 1;
      if (!payment?.client_paid && load.status !== "Cancelled") metrics.unpaidLoads += 1;
      if (!payment?.driver_paid && delivered) metrics.pendingDriverPayments += Number(load.driver_pay);
      if (!payment?.dispatcher_paid && delivered) metrics.pendingDispatcherFees += Number(load.dispatcher_fee);

      metrics.totalRevenue += Number(load.load_rate);
      if (!payment?.client_paid) metrics.outstandingRevenue += Number(load.load_rate);

      return metrics;
    },
    {
      activeLoads: 0,
      deliveredLoads: 0,
      unpaidLoads: 0,
      closedLoads: 0,
      totalRevenue: 0,
      outstandingRevenue: 0,
      pendingDriverPayments: 0,
      pendingDispatcherFees: 0,
    },
  );
}

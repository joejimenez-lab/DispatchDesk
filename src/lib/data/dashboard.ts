import { createClient } from "@/lib/supabase/server";
import { clientCollected, clientOutstanding } from "@/lib/financials";
import { mapMaintenanceAlerts } from "@/lib/data/maintenance";
import { getDashboardMaintenanceSummary } from "@/lib/maintenance";
import type { LoadStatus } from "@/types/database";

type DashboardLoad = {
  id: string;
  load_number: string;
  status: LoadStatus;
  pickup_location: string;
  pickup_date: string | null;
  delivery_location: string;
  delivery_date: string | null;
  is_round_trip: boolean;
  load_rate: number;
  driver_pay: number;
  dispatcher_fee: number;
  fuel_cost: number;
  brokers: { company_name: string } | null;
  drivers: { name: string } | null;
  payments:
    | { client_paid: boolean; client_amount_received: number; driver_paid: boolean; driver_amount_paid: number; dispatcher_paid: boolean }
    | { client_paid: boolean; client_amount_received: number; driver_paid: boolean; driver_amount_paid: number; dispatcher_paid: boolean }[]
    | null;
};

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const today = new Date(new Date().toDateString());
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [loadsResult, remindersResult] = await Promise.all([
    supabase
      .from("loads")
      .select("id, load_number, status, pickup_location, pickup_date, delivery_location, delivery_date, is_round_trip, load_rate, driver_pay, dispatcher_fee, fuel_cost, brokers(company_name), drivers(name), payments(client_paid, client_amount_received, driver_paid, driver_amount_paid, dispatcher_paid)")
      .order("created_at", { ascending: false }),
    supabase
      .from("maintenance_reminders")
      .select("*, fleet_units!inner(id, unit_number, unit_type, odometer)")
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  if (loadsResult.error) throw loadsResult.error;
  if (remindersResult.error) throw remindersResult.error;

  const rows = (loadsResult.data ?? []) as unknown as DashboardLoad[];
  const allMaintenanceAlerts = mapMaintenanceAlerts((remindersResult.data ?? []) as unknown[]);
  const maintenanceSummary = getDashboardMaintenanceSummary(allMaintenanceAlerts);

  const metrics = rows.reduce(
    (metrics, load) => {
      const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
      const active = !["Closed", "Cancelled"].includes(load.status);
      const billable = load.status !== "Cancelled";
      const delivered = ["Delivered", "Closed"].includes(load.status);

      if (active) metrics.activeLoads += 1;
      if (delivered) metrics.deliveredLoads += 1;
      if (load.status === "Closed") metrics.closedLoads += 1;
      if (clientOutstanding(load.load_rate, payment) > 0 && load.status !== "Cancelled") metrics.unpaidLoads += 1;
      if (!payment?.driver_paid && delivered) {
        metrics.pendingDriverPayments += Math.max(
          Number(load.driver_pay) - Number(payment?.driver_amount_paid ?? 0),
          0,
        );
      }
      if (!payment?.dispatcher_paid && delivered) metrics.pendingDispatcherFees += Number(load.dispatcher_fee);

      if (billable) {
        metrics.totalRevenue += Number(load.load_rate);
        metrics.collectedRevenue += clientCollected(load.load_rate, payment);
        metrics.outstandingRevenue += clientOutstanding(load.load_rate, payment);
      }

      return metrics;
    },
    {
      activeLoads: 0,
      deliveredLoads: 0,
      unpaidLoads: 0,
      closedLoads: 0,
      totalRevenue: 0,
      collectedRevenue: 0,
      outstandingRevenue: 0,
      pendingDriverPayments: 0,
      pendingDispatcherFees: 0,
    },
  );

  const currentLoads = rows
    .filter((load) => !["Closed", "Cancelled"].includes(load.status))
    .sort((a, b) => (a.delivery_date ?? "9999-12-31").localeCompare(b.delivery_date ?? "9999-12-31"))
    .slice(0, 6);

  const unpaidAlerts = rows
    .filter((load) => {
      const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
      if (clientOutstanding(load.load_rate, payment) <= 0 || load.status === "Cancelled") return false;
      const basis = load.delivery_date ?? load.pickup_date;
      if (!basis) return false;
      return new Date(`${basis}T00:00:00`) <= thirtyDaysAgo;
    })
    .sort((a, b) => (a.delivery_date ?? a.pickup_date ?? "").localeCompare(b.delivery_date ?? b.pickup_date ?? ""))
    .slice(0, 5)
    .map((load) => {
      const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
      return {
        ...load,
        outstandingAmount: clientOutstanding(load.load_rate, payment),
      };
    });

  const upcomingDeliveries = rows
    .filter((load) => {
      if (!load.delivery_date || ["Closed", "Cancelled"].includes(load.status)) return false;
      const deliveryDate = new Date(`${load.delivery_date}T00:00:00`);
      return deliveryDate >= today;
    })
    .sort((a, b) => (a.delivery_date ?? "").localeCompare(b.delivery_date ?? ""))
    .slice(0, 5);

  const statusCounts = rows.reduce<Record<string, number>>((counts, load) => {
    counts[load.status] = (counts[load.status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    ...metrics,
    currentLoads,
    unpaidAlerts,
    upcomingDeliveries,
    maintenanceAlerts: maintenanceSummary.visible,
    maintenanceCounts: maintenanceSummary.counts,
    statusCounts: Object.entries(statusCounts).sort(([, a], [, b]) => b - a),
  };
}

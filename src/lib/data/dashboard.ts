import { createClient } from "@/lib/supabase/server";
import { clientCollected, clientOutstanding, profitForLoad, roundCents, totalDeductionsForLoad } from "@/lib/financials";
import { mapMaintenanceAlerts } from "@/lib/data/maintenance";
import { buildMaintenanceReadiness, getDashboardMaintenanceSummary, summarizeMaintenanceReadiness } from "@/lib/maintenance";
import type { LoadStatus } from "@/types/database";
import { applyFleetScope, matchesFleetScope, type FleetScope } from "@/lib/fleet-scope";
import { closeoutReason, isActiveTransportation, summarizeLifecycle, type LoadCloseoutStatus } from "@/lib/load-lifecycle";

type DashboardLoad = {
  id: string;
  load_number: string;
  status: LoadStatus;
  post_delivery_status: LoadCloseoutStatus | null;
  documents_complete_at: string | null;
  closed_at: string | null;
  pickup_location: string;
  pickup_date: string | null;
  delivery_location: string;
  delivery_date: string | null;
  is_round_trip: boolean;
  return_location: string | null;
  load_rate: number;
  driver_pay: number;
  dispatcher_fee: number;
  fuel_cost: number;
  factoring_amount: number;
  load_deductions: { amount: number }[];
  brokers: { company_name: string } | null;
  drivers: { name: string } | null;
  fleet_company: string | null;
  payments:
    | { invoice_sent: boolean; client_paid: boolean; client_amount_received: number; driver_paid: boolean; driver_amount_paid: number; dispatcher_paid: boolean }
    | { invoice_sent: boolean; client_paid: boolean; client_amount_received: number; driver_paid: boolean; driver_amount_paid: number; dispatcher_paid: boolean }[]
    | null;
};

export async function getDashboardMetrics(scope: FleetScope = { kind: "all" }) {
  const supabase = await createClient();
  const today = new Date(new Date().toDateString());
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  let loadsQuery = supabase
      .from("loads")
      .select("id, load_number, status, post_delivery_status, documents_complete_at, closed_at, pickup_location, pickup_date, delivery_location, delivery_date, is_round_trip, return_location, fleet_company, load_rate, driver_pay, dispatcher_fee, fuel_cost, factoring_amount, load_deductions(amount), brokers(company_name), drivers(name), payments(invoice_sent, client_paid, client_amount_received, driver_paid, driver_amount_paid, dispatcher_paid)")
      .order("created_at", { ascending: false });
  loadsQuery = applyFleetScope(loadsQuery, scope);
  const [loadsResult, remindersResult, unitsResult] = await Promise.all([
    loadsQuery,
    supabase
      .from("maintenance_reminders")
      .select("*, fleet_units!inner(id, unit_number, unit_type, odometer, company)")
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("fleet_units").select("*").order("unit_type").order("unit_number"),
  ]);

  if (loadsResult.error) throw loadsResult.error;
  if (remindersResult.error) throw remindersResult.error;
  if (unitsResult.error) throw unitsResult.error;

  const rows = (loadsResult.data ?? []) as unknown as DashboardLoad[];
  const allMaintenanceAlerts = mapMaintenanceAlerts((remindersResult.data ?? []) as unknown[])
    .filter((alert) => matchesFleetScope(alert.unit.company, scope));
  const maintenanceSummary = getDashboardMaintenanceSummary(allMaintenanceAlerts);
  const scopedUnits = (unitsResult.data ?? []).filter((unit) => matchesFleetScope(unit.company, scope));
  const maintenanceReadiness = summarizeMaintenanceReadiness(buildMaintenanceReadiness(scopedUnits, allMaintenanceAlerts));
  const lifecycle = summarizeLifecycle(rows);

  const metrics = rows.reduce(
    (metrics, load) => {
      const payment = Array.isArray(load.payments) ? load.payments[0] : load.payments;
      const billable = load.status !== "Cancelled";
      const delivered = load.status === "Delivered";

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
        metrics.totalDeductions = roundCents(metrics.totalDeductions + totalDeductionsForLoad(load));
        metrics.estimatedProfit = roundCents(metrics.estimatedProfit + profitForLoad(load));
      }

      return metrics;
    },
    {
      unpaidLoads: 0,
      totalRevenue: 0,
      collectedRevenue: 0,
      outstandingRevenue: 0,
      pendingDriverPayments: 0,
      pendingDispatcherFees: 0,
      totalDeductions: 0,
      estimatedProfit: 0,
    },
  );

  const currentLoads = rows
    .filter((load) => isActiveTransportation(load.status))
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
      if (!load.delivery_date || !isActiveTransportation(load.status)) return false;
      const deliveryDate = new Date(`${load.delivery_date}T00:00:00`);
      return deliveryDate >= today;
    })
    .sort((a, b) => (a.delivery_date ?? "").localeCompare(b.delivery_date ?? ""))
    .slice(0, 5);

  const statusCounts = rows.reduce<Record<string, number>>((counts, load) => {
    counts[load.status] = (counts[load.status] ?? 0) + 1;
    return counts;
  }, {});

  const postDeliveryWork = rows
    .filter((load) => load.status === "Delivered" && load.post_delivery_status !== "Closed")
    .sort((a, b) => (a.delivery_date ?? "9999-12-31").localeCompare(b.delivery_date ?? "9999-12-31"))
    .slice(0, 8)
    .map((load) => ({ ...load, closeoutReason: closeoutReason(load.post_delivery_status) }));

  return {
    ...metrics,
    ...lifecycle,
    currentLoads,
    postDeliveryWork,
    unpaidAlerts,
    upcomingDeliveries,
    maintenanceAlerts: maintenanceSummary.visible,
    maintenanceCounts: { ...maintenanceSummary.counts, unconfigured: maintenanceReadiness.unconfigured },
    maintenanceReadiness,
    statusCounts: Object.entries(statusCounts).sort(([, a], [, b]) => b - a),
  };
}

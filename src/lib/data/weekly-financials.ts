import { createClient } from "@/lib/supabase/server";
import { profitForLoad } from "@/lib/financials";
import type { LoadStatus } from "@/types/database";

type WeeklyFinancialLoad = {
  id: string;
  load_number: string;
  status: LoadStatus;
  pickup_date: string | null;
  delivery_date: string | null;
  is_round_trip: boolean;
  return_location: string | null;
  round_trip_details: string | null;
  load_rate: number;
  driver_pay: number;
  dispatcher_fee: number;
  fuel_cost: number;
  created_at: string;
  driver_id: string | null;
  drivers: { name: string | null } | null;
};

export type WeeklyDriverFinancialSummary = {
  key: string;
  weekStart: string;
  weekEnd: string;
  driverId: string | null;
  driverName: string;
  loadCount: number;
  loadRateTotal: number;
  driverPayTotal: number;
  dispatcherFeeTotal: number;
  fuelCostTotal: number;
  estimatedProfitTotal: number;
  loads: {
    id: string;
    loadNumber: string;
    status: LoadStatus;
    date: string;
    isRoundTrip: boolean;
    returnLocation: string | null;
    roundTripDetails: string | null;
    loadRate: number;
    driverPay: number;
    dispatcherFee: number;
    fuelCost: number;
    estimatedProfit: number;
  }[];
};

export type WeeklyFinancialPeriod = "this" | "last" | "all" | "custom";

export type WeeklyFinancialFilters = {
  period?: WeeklyFinancialPeriod;
  from?: string;
  to?: string;
  driver?: string;
};

// Date bounds (inclusive, YYYY-MM-DD) that the report was actually filtered to,
// so callers can show the effective range. `null` on either side means open.
export type WeeklyFinancialRange = {
  from: string | null;
  to: string | null;
};

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

const pacificDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PACIFIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Calendar date (YYYY-MM-DD) for an instant, expressed in Pacific time.
function pacificDateKey(value: Date) {
  return pacificDateFormatter.format(value);
}

function dateForLoad(load: WeeklyFinancialLoad) {
  return load.delivery_date ?? load.pickup_date ?? pacificDateKey(new Date(load.created_at));
}

function addUTCDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(value.getUTCDate() + days);
  return next;
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

// Monday-to-Sunday week containing the given calendar date. The date is anchored
// to UTC and computed with UTC methods so week boundaries never drift with the
// server's local timezone.
function weekRange(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = addUTCDays(date, mondayOffset);
  const weekEnd = addUTCDays(weekStart, 6);

  return {
    weekStart: toDateKey(weekStart),
    weekEnd: toDateKey(weekEnd),
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeDate(value: string | undefined): string | null {
  return value && ISO_DATE.test(value) ? value : null;
}

function normalizeDriverId(value: string | undefined): string | null {
  return value && UUID.test(value) ? value : null;
}

// Resolve the requested filter into concrete inclusive date bounds. Presets are
// computed relative to "today" in Pacific time so the report matches the user's
// wall-clock week regardless of where the server runs.
function resolveRange(filters: WeeklyFinancialFilters): WeeklyFinancialRange {
  const today = pacificDateKey(new Date());

  switch (filters.period) {
    case "this": {
      const { weekStart, weekEnd } = weekRange(today);
      return { from: weekStart, to: weekEnd };
    }
    case "last": {
      const lastWeekDay = toDateKey(addUTCDays(new Date(`${today}T00:00:00Z`), -7));
      const { weekStart, weekEnd } = weekRange(lastWeekDay);
      return { from: weekStart, to: weekEnd };
    }
    case "custom":
      return { from: normalizeDate(filters.from), to: normalizeDate(filters.to) };
    case "all":
    default:
      return { from: null, to: null };
  }
}

export async function getWeeklyDriverFinancialSummary(
  filters: WeeklyFinancialFilters = {},
): Promise<{ summaries: WeeklyDriverFinancialSummary[]; range: WeeklyFinancialRange }> {
  const supabase = await createClient();
  const range = resolveRange(filters);
  const driverId = normalizeDriverId(filters.driver);

  let query = supabase
    .from("loads")
    .select("id, load_number, status, pickup_date, delivery_date, is_round_trip, return_location, round_trip_details, load_rate, driver_pay, dispatcher_fee, fuel_cost, created_at, driver_id, drivers(name)")
    .neq("status", "Cancelled")
    .order("delivery_date", { ascending: false, nullsFirst: false })
    .order("pickup_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.driver && !driverId) return { summaries: [], range };
  if (driverId) query = query.eq("driver_id", driverId);

  const { data, error } = await query;
  if (error) throw error;

  const summaries = new Map<string, WeeklyDriverFinancialSummary>();
  const loads = (data ?? []) as unknown as WeeklyFinancialLoad[];

  for (const load of loads) {
    const date = dateForLoad(load);
    if (range.from && date < range.from) continue;
    if (range.to && date > range.to) continue;

    const { weekStart, weekEnd } = weekRange(date);
    const driverId = load.driver_id;
    const driverName = load.drivers?.name?.trim() || "Unassigned";
    const key = `${weekStart}:${driverId ?? "unassigned"}`;
    const estimatedProfit = profitForLoad(load);
    const summary =
      summaries.get(key) ??
      {
        key,
        weekStart,
        weekEnd,
        driverId,
        driverName,
        loadCount: 0,
        loadRateTotal: 0,
        driverPayTotal: 0,
        dispatcherFeeTotal: 0,
        fuelCostTotal: 0,
        estimatedProfitTotal: 0,
        loads: [],
      };

    summary.loadCount += 1;
    summary.loadRateTotal += Number(load.load_rate);
    summary.driverPayTotal += Number(load.driver_pay);
    summary.dispatcherFeeTotal += Number(load.dispatcher_fee);
    summary.fuelCostTotal += Number(load.fuel_cost);
    summary.estimatedProfitTotal += estimatedProfit;
    summary.loads.push({
      id: load.id,
      loadNumber: load.load_number,
      status: load.status,
      date,
      isRoundTrip: load.is_round_trip,
      returnLocation: load.return_location,
      roundTripDetails: load.round_trip_details,
      loadRate: Number(load.load_rate),
      driverPay: Number(load.driver_pay),
      dispatcherFee: Number(load.dispatcher_fee),
      fuelCost: Number(load.fuel_cost),
      estimatedProfit,
    });

    summaries.set(key, summary);
  }

  const result = [...summaries.values()]
    .map((summary) => ({
      ...summary,
      loads: summary.loads.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.driverName.localeCompare(b.driverName));

  return { summaries: result, range };
}

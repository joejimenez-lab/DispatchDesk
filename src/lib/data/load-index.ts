import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFleetScope, type FleetScope } from "@/lib/fleet-scope";
import { searchTokens } from "@/lib/search";
import { loadStatuses, type Database, type LoadCloseoutStatus, type LoadStatus } from "@/types/database";
import type { FinancialCompletenessFilter } from "@/lib/financials";
import { pageRange, type Pagination } from "@/lib/pagination";

const ACTIVE_LOAD_STATUSES: LoadStatus[] = ["Booked", "Dispatched", "Picked Up", "In Transit"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INDEX_CHUNK_SIZE = 1_000;

export type LoadView = "active" | "recent" | "all" | LoadStatus;

export type LoadIndexFilters = {
  q?: string | null;
  status?: string | null;
  closeout?: string | null;
  broker?: string | null;
  driver?: string | null;
  payment?: string | null;
  financial?: string | null;
  fleetScope?: FleetScope;
  from?: string | null;
  to?: string | null;
};

export function normalizeLoadView(value: string | null | undefined): LoadView {
  if (!value) return "active";
  if (value === "active" || value === "recent" || value === "all") return value;
  return loadStatuses.includes(value as LoadStatus) ? value as LoadStatus : "active";
}

function buildLoadIndexQuery(
  supabase: SupabaseClient<Database>,
  filters: LoadIndexFilters,
  count = false,
) {
  let query = supabase
    .from("load_list_index")
    .select("id", count ? { count: "exact" } : {})
    .order("delivery_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (!filters.closeout && filters.status) {
    if (filters.status === "active") query = query.in("status", ACTIVE_LOAD_STATUSES);
    else if (filters.status === "recent") {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - 30);
      query = query.gte("created_at", cutoff.toISOString());
    } else if (filters.status !== "all" && loadStatuses.includes(filters.status as LoadStatus)) {
      query = query.eq("status", filters.status as LoadStatus);
    }
  }

  if (filters.closeout === "all-open") {
    query = query.eq("status", "Delivered").or("post_delivery_status.is.null,post_delivery_status.neq.Closed");
  } else if (filters.closeout) {
    query = query.eq("post_delivery_status", filters.closeout as LoadCloseoutStatus);
  }
  if (filters.broker) query = query.eq("broker_id", filters.broker);
  if (filters.driver) query = query.eq("driver_id", filters.driver);
  if (filters.fleetScope) query = applyFleetScope(query, filters.fleetScope);

  if (filters.payment === "paid") query = query.eq("client_paid", true);
  else if (filters.payment === "unpaid") query = query.eq("client_paid", false).neq("status", "Cancelled");

  const financial = (["all", "complete", "incomplete"] as const).includes(filters.financial as FinancialCompletenessFilter)
    ? filters.financial as FinancialCompletenessFilter
    : "all";
  if (financial === "complete") {
    query = query.eq("driver_pay_known", true).eq("dispatcher_fee_known", true).eq("fuel_cost_known", true);
  } else if (financial === "incomplete") {
    query = query.or("driver_pay_known.eq.false,dispatcher_fee_known.eq.false,fuel_cost_known.eq.false");
  }

  if (filters.from && ISO_DATE.test(filters.from)) {
    query = query.or([
      `delivery_date.gte.${filters.from}`,
      `and(delivery_date.is.null,pickup_date.gte.${filters.from})`,
      `and(delivery_date.is.null,pickup_date.is.null,created_at.gte.${filters.from}T00:00:00Z)`,
    ].join(","));
  }
  if (filters.to && ISO_DATE.test(filters.to)) {
    const exclusiveEnd = new Date(`${filters.to}T00:00:00Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    query = query.or([
      `delivery_date.lte.${filters.to}`,
      `and(delivery_date.is.null,pickup_date.lte.${filters.to})`,
      `and(delivery_date.is.null,pickup_date.is.null,created_at.lt.${exclusiveEnd.toISOString()})`,
    ].join(","));
  }

  for (const token of searchTokens(filters.q)) query = query.ilike("search_text", `%${token}%`);
  return query;
}

export async function getLoadIndexPage(
  supabase: SupabaseClient<Database>,
  filters: LoadIndexFilters,
  pagination: Pagination,
) {
  const { from, to } = pageRange(pagination);
  const { data, error, count } = await buildLoadIndexQuery(supabase, filters, true).range(from, to);
  if (error) throw error;
  return {
    ids: (data ?? []).flatMap((row) => row.id ? [row.id] : []),
    total: count ?? 0,
  };
}

export async function getAllLoadIndexIds(
  supabase: SupabaseClient<Database>,
  filters: LoadIndexFilters,
) {
  const ids: string[] = [];
  for (let offset = 0; ; offset += INDEX_CHUNK_SIZE) {
    const { data, error } = await buildLoadIndexQuery(supabase, filters).range(offset, offset + INDEX_CHUNK_SIZE - 1);
    if (error) throw error;
    const chunk = (data ?? []).flatMap((row) => row.id ? [row.id] : []);
    ids.push(...chunk);
    if ((data ?? []).length < INDEX_CHUNK_SIZE) break;
  }
  return ids;
}

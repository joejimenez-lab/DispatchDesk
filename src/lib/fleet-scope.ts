import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const UNASSIGNED_FLEET = "__unassigned__";

export type FleetScope =
  | { kind: "all" }
  | { kind: "fleet"; company: string }
  | { kind: "unassigned" };

export function parseFleetScope(value: string | null | undefined, companies: string[]): FleetScope | null {
  const requested = value?.trim();
  if (!requested) return { kind: "all" };
  if (requested === UNASSIGNED_FLEET) return { kind: "unassigned" };
  const company = companies.find((candidate) => candidate.localeCompare(requested, undefined, { sensitivity: "accent" }) === 0);
  return company ? { kind: "fleet", company } : null;
}

function parseFleetScopeParam(value: string | null | undefined): FleetScope {
  const requested = value?.trim();
  if (!requested) return { kind: "all" };
  if (requested === UNASSIGNED_FLEET) return { kind: "unassigned" };
  return { kind: "fleet", company: requested };
}

export async function resolveExportFleetScope(
  supabase: SupabaseClient<Database>,
  value: string | null | undefined,
): Promise<FleetScope | null> {
  const requested = parseFleetScopeParam(value);
  if (requested.kind !== "fleet") return requested;

  const [units, loads] = await Promise.all([
    supabase.from("fleet_units").select("company").not("company", "is", null),
    supabase.from("loads").select("fleet_company").not("fleet_company", "is", null),
  ]);
  if (units.error) throw units.error;
  if (loads.error) throw loads.error;

  const companies = [
    ...(units.data ?? []).map((row) => row.company),
    ...(loads.data ?? []).map((row) => row.fleet_company),
  ].flatMap((company) => company?.trim() ? [company.trim()] : []);
  return parseFleetScope(requested.company, companies);
}

export function fleetScopeParam(scope: FleetScope) {
  return scope.kind === "fleet" ? scope.company : scope.kind === "unassigned" ? UNASSIGNED_FLEET : "";
}

export function fleetScopeLabel(scope: FleetScope) {
  return scope.kind === "fleet" ? scope.company : scope.kind === "unassigned" ? "Unassigned" : "All fleets";
}

export function fleetScopeSlug(scope: FleetScope) {
  if (scope.kind === "all") return "all-fleets";
  if (scope.kind === "unassigned") return "unassigned";
  return scope.company.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fleet";
}

export function matchesFleetScope(company: string | null | undefined, scope: FleetScope) {
  if (scope.kind === "all") return true;
  if (scope.kind === "unassigned") return !company?.trim();
  return company?.localeCompare(scope.company, undefined, { sensitivity: "accent" }) === 0;
}

export function applyFleetScope<T extends { eq(column: string, value: string): T; is(column: string, value: null): T }>(
  query: T,
  scope: FleetScope,
  column = "fleet_company",
) {
  if (scope.kind === "fleet") return query.eq(column, scope.company);
  if (scope.kind === "unassigned") return query.is(column, null);
  return query;
}

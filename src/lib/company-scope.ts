import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const UNASSIGNED_COMPANY = "__unassigned__";

export type CompanyScope =
  | { kind: "all" }
  | { kind: "company"; company: string }
  | { kind: "unassigned" };

export function parseCompanyScope(value: string | null | undefined, companies: string[]): CompanyScope | null {
  const requested = value?.trim();
  if (!requested) return { kind: "all" };
  if (requested === UNASSIGNED_COMPANY) return { kind: "unassigned" };
  const company = companies.find((candidate) => candidate.localeCompare(requested, undefined, { sensitivity: "accent" }) === 0);
  return company ? { kind: "company", company } : null;
}

function parseCompanyScopeParam(value: string | null | undefined): CompanyScope {
  const requested = value?.trim();
  if (!requested) return { kind: "all" };
  if (requested === UNASSIGNED_COMPANY) return { kind: "unassigned" };
  return { kind: "company", company: requested };
}

export async function resolveExportCompanyScope(
  supabase: SupabaseClient<Database>,
  value: string | null | undefined,
): Promise<CompanyScope | null> {
  const requested = parseCompanyScopeParam(value);
  if (requested.kind !== "company") return requested;

  const companies = await getAccountingCompanies(supabase);
  return parseCompanyScope(requested.company, companies);
}

export function companyScopeParam(scope: CompanyScope) {
  return scope.kind === "company" ? scope.company : scope.kind === "unassigned" ? UNASSIGNED_COMPANY : "";
}

export function companyScopeLabel(scope: CompanyScope) {
  return scope.kind === "company" ? scope.company : scope.kind === "unassigned" ? "Unassigned" : "All companies";
}

export function companyScopeSlug(scope: CompanyScope) {
  if (scope.kind === "all") return "all-companies";
  if (scope.kind === "unassigned") return "unassigned";
  return scope.company.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
}

export function matchesCompanyScope(company: string | null | undefined, scope: CompanyScope) {
  if (scope.kind === "all") return true;
  if (scope.kind === "unassigned") return !company?.trim();
  return company?.localeCompare(scope.company, undefined, { sensitivity: "accent" }) === 0;
}

export function applyCompanyScope<T extends { eq(column: string, value: string): T; is(column: string, value: null): T }>(
  query: T,
  scope: CompanyScope,
  column = "accounting_company",
) {
  if (scope.kind === "company") return query.eq(column, scope.company);
  if (scope.kind === "unassigned") return query.is(column, null);
  return query;
}

// Fetch all pages so carrier-only companies and historical data stay selectable.
export async function getAccountingCompanies(supabase: SupabaseClient<Database>) {
  const companies = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("loads")
      .select("accounting_company").not("accounting_company", "is", null)
      .order("id").range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) if (row.accounting_company) companies.add(row.accounting_company);
    if ((data ?? []).length < 1000) break;
  }
  return [...companies].sort((a, b) => a.localeCompare(b));
}

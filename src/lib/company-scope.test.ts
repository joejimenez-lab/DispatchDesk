import { describe, expect, it, vi } from "vitest";
import { applyCompanyScope, getAccountingCompanies, matchesCompanyScope, parseCompanyScope, UNASSIGNED_COMPANY } from "./company-scope";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

describe("carrier company scope", () => {
  it("recognizes carrier-only companies and keeps missing carriers unassigned", () => {
    expect(parseCompanyScope("js", ["DC", "RD", "JS"])).toEqual({ kind: "company", company: "JS" });
    expect(parseCompanyScope("Unknown", ["DC", "RD"])).toBeNull();
    expect(parseCompanyScope(UNASSIGNED_COMPANY, [])).toEqual({ kind: "unassigned" });
    expect(matchesCompanyScope(null, { kind: "company", company: "DC" })).toBe(false);
    expect(matchesCompanyScope(null, { kind: "unassigned" })).toBe(true);
  });
  it("filters the carrier accounting column instead of equipment", () => {
    const query = { eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis() };
    applyCompanyScope(query, { kind: "company", company: "DC" });
    expect(query.eq).toHaveBeenCalledWith("accounting_company", "DC");
    applyCompanyScope(query, { kind: "unassigned" });
    expect(query.is).toHaveBeenCalledWith("accounting_company", null);
  });
  it("includes companies beyond the first API page", async () => {
    const query = { select: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn() };
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ accounting_company: "DC" })), error: null })
      .mockResolvedValueOnce({ data: [{ accounting_company: "JS" }], error: null });
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;
    expect(await getAccountingCompanies(client)).toEqual(["DC", "JS"]);
    expect(query.range).toHaveBeenLastCalledWith(1000, 1999);
  });
});

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  fleetScopeLabel,
  fleetScopeSlug,
  matchesFleetScope,
  parseFleetScope,
  resolveExportFleetScope,
  UNASSIGNED_FLEET,
} from "./fleet-scope";

describe("fleet scopes", () => {
  const companies = ["RD", "RC"];

  it("canonicalizes tenant-visible names and rejects unknown page scopes", () => {
    expect(parseFleetScope("rd", companies)).toEqual({ kind: "fleet", company: "RD" });
    expect(parseFleetScope("unknown", companies)).toBeNull();
  });

  it("represents all fleets and unassigned explicitly", () => {
    expect(parseFleetScope(undefined, companies)).toEqual({ kind: "all" });
    expect(parseFleetScope(UNASSIGNED_FLEET, companies)).toEqual({ kind: "unassigned" });
    expect(fleetScopeLabel({ kind: "all" })).toBe("All fleets");
    expect(fleetScopeSlug({ kind: "unassigned" })).toBe("unassigned");
  });

  it("partitions records from two fleets and unassigned without overlap", () => {
    const rows = [{ fleet: "RD" }, { fleet: "RC" }, { fleet: null }];
    const rd = rows.filter((row) => matchesFleetScope(row.fleet, { kind: "fleet", company: "RD" }));
    const rc = rows.filter((row) => matchesFleetScope(row.fleet, { kind: "fleet", company: "RC" }));
    const unassigned = rows.filter((row) => matchesFleetScope(row.fleet, { kind: "unassigned" }));
    expect([...rd, ...rc, ...unassigned]).toHaveLength(rows.length);
    expect(rows.filter((row) => matchesFleetScope(row.fleet, { kind: "all" }))).toHaveLength(rows.length);
  });

  it("validates export scopes against tenant-configured and historical fleets", async () => {
    const results = {
      fleet_units: { data: [{ company: "West" }], error: null },
      loads: { data: [{ fleet_company: "Legacy" }], error: null },
    };
    const supabase = {
      from: (table: keyof typeof results) => ({
        select: () => ({ not: async () => results[table] }),
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(resolveExportFleetScope(supabase, "west")).resolves.toEqual({ kind: "fleet", company: "West" });
    await expect(resolveExportFleetScope(supabase, "legacy")).resolves.toEqual({ kind: "fleet", company: "Legacy" });
    await expect(resolveExportFleetScope(supabase, "unknown")).resolves.toBeNull();
    await expect(resolveExportFleetScope(supabase, UNASSIGNED_FLEET)).resolves.toEqual({ kind: "unassigned" });
    await expect(resolveExportFleetScope(supabase, null)).resolves.toEqual({ kind: "all" });
  });
});

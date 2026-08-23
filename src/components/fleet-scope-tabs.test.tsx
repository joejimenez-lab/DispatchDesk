// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FleetScopeTabs, fleetScopedHref } from "./fleet-scope-tabs";
import { UNASSIGNED_FLEET } from "@/lib/fleet-scope";

describe("FleetScopeTabs", () => {
  it("shows all, two named fleets, and unassigned", () => {
    render(<FleetScopeTabs basePath="/loads" companies={["RD", "RC"]} scope={{ kind: "unassigned" }} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Unassigned" }).getAttribute("aria-current")).toBe("page");
  });

  it("preserves feature filters when changing scope", () => {
    expect(fleetScopedHref("/loads", UNASSIGNED_FLEET, { status: "Booked", q: "" }))
      .toBe(`/loads?fleet=${UNASSIGNED_FLEET}&status=Booked`);
  });
});

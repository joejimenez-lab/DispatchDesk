// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MaintenanceReadiness } from "@/lib/maintenance";
import { MaintenanceSetupForm } from "./maintenance-setup-form";

afterEach(cleanup);

function item(id: string, number: string, configured: boolean): MaintenanceReadiness {
  return {
    unit: {
      id,
      organization_id: "10000000-0000-4000-8000-000000000010",
      unit_number: number,
      unit_type: "Truck",
      company: "DCG",
      odometer: configured ? 100_000 : null,
      odometer_updated_at: configured ? "2026-08-31T12:00:00Z" : null,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    configured,
    missingOdometer: !configured,
    missingSchedule: !configured,
    odometerFreshness: configured ? "fresh" : "missing",
    odometerAgeDays: configured ? 0 : null,
  };
}

describe("MaintenanceSetupForm", () => {
  const incomplete = item("10000000-0000-4000-8000-000000000001", "T-1", false);
  const configured = item("10000000-0000-4000-8000-000000000002", "T-2", true);

  it("preselects incomplete units and supports efficient bulk selection", () => {
    render(<MaintenanceSetupForm action={vi.fn()} readiness={[incomplete, configured]} />);
    expect((screen.getByLabelText("Select T-1") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Select T-2") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect((screen.getByLabelText("Select T-2") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect((screen.getByRole("button", { name: "Update selected units" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps default templates enabled and disables unselected odometer fields", () => {
    render(<MaintenanceSetupForm action={vi.fn()} readiness={[incomplete, configured]} />);
    expect((screen.getByRole("checkbox", { name: /Apply missing default schedules/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("New odometer for T-1") as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText("New odometer for T-2") as HTMLInputElement).disabled).toBe(true);
  });
});

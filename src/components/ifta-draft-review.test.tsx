// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IftaDraftReview } from "@/components/ifta-draft-review";
import type { IftaDraft } from "@/lib/data/ifta";

vi.mock("@/lib/actions/ifta", () => ({ reviewIftaDraft: vi.fn() }));
afterEach(cleanup);

const tripDraft = {
  id: "85000000-0000-4000-8000-000000000001",
  organization_id: "85000000-0000-4000-8000-000000000002",
  draft_type: "trip",
  status: "pending",
  source_load_id: "85000000-0000-4000-8000-000000000003",
  source_expense_group_id: null,
  report_date: "2026-05-01",
  payload: {
    unit_id: null,
    truck_number: null,
    start_date: "2026-05-01",
    end_date: "2026-05-02",
    pickup_city: "Reno, NV",
    dropoff_city: "Phoenix, AZ",
    state_miles: [],
    suggested_states: ["NV", "AZ"],
    notes: "Generated from load IFTA-L1",
  },
  missing_fields: ["truck", "mileage"],
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
  approved_trip_id: null,
  approved_fuel_purchase_id: null,
  created_at: "2026-05-03T00:00:00Z",
  updated_at: "2026-05-03T00:00:00Z",
  loads: { id: "85000000-0000-4000-8000-000000000003", load_number: "IFTA-L1" },
  bookkeeping_expense_groups: null,
} as IftaDraft;

describe("IftaDraftReview", () => {
  it("shows source, missing fields, honest state hints, and all review controls", () => {
    render(<IftaDraftReview draft={tripDraft} trucks={[{ id: "truck-1", unit_number: "85", company: "RD" }]} />);

    expect(screen.getByRole("link", { name: "Load IFTA-L1" })).toBeTruthy();
    expect(screen.getByText("Missing: truck, mileage")).toBeTruthy();
    expect(screen.getByText(/Stop addresses suggest NV, AZ/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve & post" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exclude source" })).toBeTruthy();
  });

  it("allows adding and removing state mileage rows", () => {
    render(<IftaDraftReview draft={tripDraft} trucks={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add state" }));
    expect(screen.getAllByRole("combobox", { name: "" }).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });
});

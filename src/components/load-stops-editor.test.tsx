// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { LoadStopsEditor, type EditableStop } from "@/components/load-stops-editor";

const initial: EditableStop[] = [
  { key: "pickup", position: 0, stop_type: "Pickup", location: "Los Angeles, CA", scheduled_start: null, scheduled_end: null, schedule_precision: "window", time_zone: "America/Los_Angeles", appointment_number: null, reference_number: null, instructions: null },
  { key: "delivery", position: 1, stop_type: "Delivery", location: "Phoenix, AZ", scheduled_start: null, scheduled_end: null, schedule_precision: "window", time_zone: "America/Phoenix", appointment_number: null, reference_number: null, instructions: null },
];

function Harness() {
  const [stops, setStops] = useState(initial);
  return <form><LoadStopsEditor stops={stops} onChange={setStops} /></form>;
}

describe("LoadStopsEditor", () => {
  it("adds, reorders, and removes structured stops", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add stop" }));
    expect(screen.getAllByLabelText("Stop type")).toHaveLength(3);

    fireEvent.change(screen.getAllByLabelText("Stop type")[2], { target: { value: "Return" } });
    fireEvent.click(screen.getByRole("button", { name: "Move stop 3 up" }));
    expect((screen.getAllByLabelText("Stop type")[1] as HTMLSelectElement).value).toBe("Return");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(screen.getAllByLabelText("Stop type")).toHaveLength(2);
  });

  it("marks a date-only legacy stop as a timed window when edited", () => {
    render(<form><LoadStopsEditor stops={[{ ...initial[0], scheduled_start: "2026-08-31T00:00", scheduled_end: "2026-08-31T23:59", schedule_precision: "date" }, initial[1]]} onChange={() => undefined} /></form>);
    expect(screen.getByText(/Date only/)).toBeTruthy();
  });
});

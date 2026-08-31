// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadEquipmentFields } from "./load-equipment-fields";

afterEach(cleanup);

const equipment = [
  { id: "truck-a", unit_number: "A-1", unit_type: "Truck" as const, company: "Fleet A" },
  { id: "trailer-a", unit_number: "A-9", unit_type: "Trailer" as const, company: "Fleet A" },
  { id: "truck-b", unit_number: "B-1", unit_type: "Truck" as const, company: "Fleet B" },
  { id: "trailer-b", unit_number: "B-9", unit_type: "Trailer" as const, company: "Fleet B" },
];

const drivers = [
  { id: "driver-a", name: "Driver A", truck_number: "A-1", trailer_number: "A-9" },
  { id: "driver-b", name: "Driver B", truck_number: "B-1", trailer_number: "B-9" },
];

describe("LoadEquipmentFields", () => {
  it("filters truck and trailer choices by fleet and unit type", () => {
    render(<LoadEquipmentFields drivers={drivers} equipment={equipment} />);

    fireEvent.change(screen.getByLabelText("Fleet"), { target: { value: "Fleet A" } });

    const truck = screen.getByLabelText("Truck");
    const trailer = screen.getByLabelText("Trailer");
    expect(within(truck).getByRole("option", { name: "A-1" })).toBeTruthy();
    expect(within(truck).queryByRole("option", { name: "B-1" })).toBeNull();
    expect(within(truck).queryByRole("option", { name: "A-9" })).toBeNull();
    expect(within(trailer).getByRole("option", { name: "A-9" })).toBeTruthy();
    expect(within(trailer).queryByRole("option", { name: "B-9" })).toBeNull();
  });

  it("suggests uniquely matched equipment from a newly selected driver", () => {
    render(<LoadEquipmentFields drivers={drivers} equipment={equipment} />);

    fireEvent.change(screen.getByLabelText(/^Driver/), { target: { value: "driver-a" } });

    expect((screen.getByLabelText("Fleet") as HTMLSelectElement).value).toBe("Fleet A");
    expect((screen.getByLabelText("Truck") as HTMLSelectElement).value).toBe("truck-a");
    expect((screen.getByLabelText("Trailer") as HTMLSelectElement).value).toBe("trailer-a");
  });

  it("does not replace a manual equipment choice when the driver changes", () => {
    render(<LoadEquipmentFields drivers={drivers} equipment={equipment} />);

    fireEvent.change(screen.getByLabelText("Fleet"), { target: { value: "Fleet B" } });
    fireEvent.change(screen.getByLabelText("Truck"), { target: { value: "truck-b" } });
    fireEvent.change(screen.getByLabelText("Trailer"), { target: { value: "trailer-b" } });
    fireEvent.change(screen.getByLabelText(/^Driver/), { target: { value: "driver-a" } });

    expect((screen.getByLabelText("Fleet") as HTMLSelectElement).value).toBe("Fleet B");
    expect((screen.getByLabelText("Truck") as HTMLSelectElement).value).toBe("truck-b");
    expect((screen.getByLabelText("Trailer") as HTMLSelectElement).value).toBe("trailer-b");
  });

  it("reports assignment changes for advisory conflict detection", () => {
    const onAssignmentChange = vi.fn();
    render(<LoadEquipmentFields drivers={drivers} equipment={equipment} onAssignmentChange={onAssignmentChange} />);
    fireEvent.change(screen.getByLabelText(/^Driver/), { target: { value: "driver-a" } });
    expect(onAssignmentChange).toHaveBeenLastCalledWith({ driverId: "driver-a", truckUnitId: "truck-a", trailerUnitId: "trailer-a" });
  });
});

import { describe, expect, it } from "vitest";
import { findAssignmentConflicts, formatStopWindow, scheduleWindow, zonedDateTimeToEpoch, type DispatchStop } from "@/lib/dispatch";

const stop = (start: string, end: string, zone = "America/Los_Angeles"): DispatchStop => ({
  position: 0,
  stop_type: "Pickup",
  location: "Los Angeles, CA",
  scheduled_start: start,
  scheduled_end: end,
  schedule_precision: "window",
  time_zone: zone,
  appointment_number: null,
  reference_number: null,
  instructions: null,
});

describe("dispatch scheduling", () => {
  it("converts local appointment times using their IANA zone", () => {
    expect(zonedDateTimeToEpoch("2026-08-31T09:00", "America/Los_Angeles"))
      .toBe(zonedDateTimeToEpoch("2026-08-31T10:00", "America/Denver"));
  });

  it("builds a load window from the earliest and latest timed stops", () => {
    expect(scheduleWindow([
      stop("2026-08-31T09:00", "2026-08-31T10:00"),
      { ...stop("2026-09-01T13:00", "2026-09-01T14:00", "America/Denver"), position: 1, stop_type: "Delivery" },
    ])).toEqual({
      startMs: zonedDateTimeToEpoch("2026-08-31T09:00", "America/Los_Angeles"),
      endMs: zonedDateTimeToEpoch("2026-09-01T14:00", "America/Denver"),
    });
  });

  it("explains overlapping driver and equipment assignments without blocking", () => {
    const conflicts = findAssignmentConflicts(
      { driverId: "driver-1", truckUnitId: "truck-1", trailerUnitId: "trailer-2" },
      [stop("2026-08-31T09:00", "2026-08-31T12:00")],
      [{ loadId: "load-2", loadNumber: "L-2", driverId: "driver-1", driverName: "Driver", truckUnitId: "truck-1", truckNumber: "101", trailerUnitId: "trailer-1", trailerNumber: "5001", startMs: zonedDateTimeToEpoch("2026-08-31T10:00", "America/Los_Angeles")!, endMs: zonedDateTimeToEpoch("2026-08-31T13:00", "America/Los_Angeles")! }],
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resources).toEqual(["Driver Driver", "Truck 101"]);
  });

  it("keeps date-only legacy stops out of conflict calculations", () => {
    expect(scheduleWindow([{ ...stop("2026-08-31T00:00", "2026-08-31T23:59"), schedule_precision: "date" }])).toBeNull();
    expect(formatStopWindow({ ...stop("2026-08-31T00:00", "2026-08-31T23:59"), schedule_precision: "date" })).toContain("date only");
  });
});
